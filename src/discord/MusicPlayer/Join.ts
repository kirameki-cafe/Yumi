import {
    Message,
    CommandInteraction,
    VoiceChannel,
    DMChannel,
    StageChannel,
    ActionRowBuilder,
    ButtonBuilder,
    PermissionsBitField,
    ButtonStyle,
    BaseGuildTextChannel,
    BaseGuildVoiceChannel
} from 'discord.js';
import { I18n } from 'i18n';

import {
    makeSuccessEmbed,
    makeErrorEmbed,
    sendMessage,
    sendHybridInteractionMessageResponse,
    makeInfoEmbed
} from '../../utils/DiscordMessage';
import DiscordProvider from '../../providers/Discord';
import DiscordMusicPlayer, {
    PlayerPlayingEvent,
    PlayerErrorEvent,
    VoiceDisconnectedEvent,
    ValidTracks,
    DiscordMusicPlayerInstance,
    DiscordMusicPlayerLoopMode,
    TrackUtils
} from '../../providers/DiscordMusicPlayer';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import Locale from '../../services/Locale';
import { SpotifyTrack, YouTubeVideo } from 'play-dl';
import { checkBotPermissionsInChannel } from '../../utils/DiscordPermission';

const EMBEDS = {
    VOICECHANNEL_JOINED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_join.success'),
            user: data.getUser()
        });
    },
    VOICECHANNEL_DISCONNECTED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_join.disconnected'),
            description: locale.__('musicplayer_join.disconnected_reason_disconnected'),
            user: DiscordProvider.client.user
        });
    },
    VOICECHANNEL_INUSE: (data: HybridInteractionMessage, locale: I18n, haveForceMove: boolean) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer_join.error'),
            description: `${locale.__('musicplayer_join.in_use')}\n\n${locale.__('musicplayer_join.in_use_wait')}${
                haveForceMove ? locale.__('musicplayer_join.can_force_move') : ''
            }`,
            user: data.getUser()
        });
    },
    VOICECHANNEL_ALREADY_JOINED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('musicplayer_join.already_joined_title'),
            description: locale.__('musicplayer_join.already_joined_description'),
            user: data.getUser()
        });
    },
    USER_NOT_IN_VOICECHANNEL: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.not_in_voice'),
            user: data.getUser()
        });
    },
    MUSIC_ERROR: (data: HybridInteractionMessage, locale: I18n, error: Error) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.track_error'),
            description: error.message,
            user: data.getUser()
        });
    },
    NOW_PLAYING: async (data: HybridInteractionMessage, locale: I18n, track: ValidTracks) => {

        const title = TrackUtils.getTitle(track);
        const thumbnails = await TrackUtils.getThumbnails(track);

        const embed = makeInfoEmbed({
            title: locale.__('musicplayer.now_playing'),
            icon: '🎵 ',
            description: title,
            user: DiscordProvider.client.user
        });

        if (TrackUtils.getHighestResolutionThumbnail(thumbnails))
            embed.setImage(TrackUtils.getHighestResolutionThumbnail(thumbnails).url);

        return embed;
    },
    NOW_REPEATING: async (data: HybridInteractionMessage, locale: I18n, track: ValidTracks) => {

        const title = TrackUtils.getTitle(track);
        const thumbnails = await TrackUtils.getThumbnails(track);

        const embed = makeInfoEmbed({
            title: locale.__('musicplayer.now_playing_repeating'),
            icon: '🎵 ',
            description: title,
            user: DiscordProvider.client.user
        });

        if (TrackUtils.getHighestResolutionThumbnail(thumbnails))
            embed.setImage(TrackUtils.getHighestResolutionThumbnail(thumbnails).url);

        return embed;
    }
};

export async function joinVoiceChannelProcedure(
    data: HybridInteractionMessage,
    instance: DiscordMusicPlayerInstance | null,
    voiceChannel: VoiceChannel | StageChannel
) {
    const isSlashCommand = data.isApplicationCommand();
    const isAcceptableInteraction = data.isSelectMenu() || data.isButton();
    const isMessage = data.isMessage();
    if (!isSlashCommand && !isAcceptableInteraction && !isMessage) return;

    const member = data.getMember();
    const channel = data.getChannel();
    const guild = data.getGuild();

    if (!member || !channel || !guild) return;

    if (channel instanceof DMChannel) return;
    if (!(channel instanceof BaseGuildTextChannel || channel instanceof BaseGuildVoiceChannel)) return;

    const memberVoiceChannel = member.voice.channel;
    if (!memberVoiceChannel) return;

    const bot = guild.members.me;
    if (!bot) return;

    const locale = await Locale.getGuildLocale(guild.id);
    
    if(!await checkBotPermissionsInChannel({ guild, data, locale, channel: memberVoiceChannel, permissions: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]})) return;

    // If already in VoiceChannel
    if (bot.voice.channelId) {
        // But, no music instance yet (The bot might just restarted)
        if (!instance) {
            // User is in different VoiceChannel
            if (memberVoiceChannel.id !== bot.voice.channelId) {
                //Disconnect it
                await bot.voice.disconnect();
            }

            //Create instance for a new one
            DiscordMusicPlayer.createGuildInstance(guild.id, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(guild.id);

            instance!.joinVoiceChannel(voiceChannel, channel);
            if (!isAcceptableInteraction)
                await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.VOICECHANNEL_JOINED(data, locale)]
                });
        }
        // And, already have instance on the guild
        else {
            // And, User VoiceChannel is same as the instance
            if (memberVoiceChannel.id === instance.voiceChannel.id) {
                if (!isAcceptableInteraction)
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.VOICECHANNEL_ALREADY_JOINED(data, locale)]
                    });
                else return;
            }
            // But, not the same VoiceChannel
            else {
                let activeMembers = instance.voiceChannel.members.filter((member) => member.user.bot === false);
                // And someone else is using the bot
                if (activeMembers.size > 0) {
                    if (!isAcceptableInteraction)
                        return await sendHybridInteractionMessageResponse(data, {
                            embeds: [
                                EMBEDS.VOICECHANNEL_INUSE(
                                    data,
                                    locale,
                                    member.permissions.has([PermissionsBitField.Flags.MoveMembers])
                                )
                            ]
                        });
                    else return;
                }
                // And alone in the VoiceChannel
                else {
                    // Move to the new voice channel
                    await bot.voice.setChannel(voiceChannel);
                    if (!isAcceptableInteraction)
                        return await sendHybridInteractionMessageResponse(data, {
                            embeds: [EMBEDS.VOICECHANNEL_JOINED(data, locale)]
                        });
                    else return;
                }
            }
        }
    }
    // Not in any VoiceChannel
    else {
        if (instance) await DiscordMusicPlayer.destoryGuildInstance(guild.id);

        DiscordMusicPlayer.createGuildInstance(guild.id, voiceChannel);
        instance = DiscordMusicPlayer.getGuildInstance(guild.id);

        instance!.joinVoiceChannel(voiceChannel, channel);
        if (!isAcceptableInteraction)
            await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data, locale)] });
    }

    if (!instance) return;

    let previousTrack: ValidTracks | undefined;
    let isLoopMessageSent = false;

    // Register Event Listeners
    instance.events.on('playing', async (event: PlayerPlayingEvent) => {
        const locale = await Locale.getGuildLocale(guild.id);
        if (!event.instance.queue || !event.instance.queue.track || event.instance.queue.track.length === 0) return;
        previousTrack = event.instance.getPreviousTrack();

        if (event.instance.queue.track[0] !== previousTrack) isLoopMessageSent = false;
        else if (event.instance.queue.track[0] === previousTrack && isLoopMessageSent) return;

        const row = new ActionRowBuilder<ButtonBuilder>();
        if(event.instance.queue.track[0] instanceof SpotifyTrack)
            row.addComponents([
                new ButtonBuilder()
                    .setEmoji('🟢')
                    .setLabel(' Open in Spotify')
                    .setURL(encodeURI(`https://open.spotify.com/track/${event.instance.queue.track[0].id}`))
                    .setStyle(ButtonStyle.Link)
            ]);
        if(event.instance.queue.track[0] instanceof YouTubeVideo || event.instance.queue.track[0] instanceof SpotifyTrack) {
            const actualPlaybackURL = event.instance.getActualPlaybackURL();
            if(event.instance.queue.track[0] instanceof SpotifyTrack && !actualPlaybackURL) return;
            row.addComponents([
                new ButtonBuilder()
                    .setEmoji('🔴')
                    .setLabel(' Open in YouTube')
                    .setURL(event.instance.queue.track[0] instanceof YouTubeVideo ? encodeURI(`https://www.youtube.com/watch?v=${event.instance.queue.track[0].id}`) : encodeURI(event.instance.getActualPlaybackURL()!))
                    .setStyle(ButtonStyle.Link)
            ]);
        }

        if (event.instance.textChannel) {
            if (event.instance.getLoopMode() === DiscordMusicPlayerLoopMode.Current) {
                isLoopMessageSent = true;
                await sendMessage(event.instance.textChannel, undefined, {
                    embeds: [await EMBEDS.NOW_REPEATING(data, locale, event.instance.queue.track[0])],
                    components: [row]
                });
            } else {
                await sendMessage(event.instance.textChannel, undefined, {
                    embeds: [await EMBEDS.NOW_PLAYING(data, locale, event.instance.queue.track[0])],
                    components: [row]
                });
            }
        }
    });

    instance.events.on('error', async (event: PlayerErrorEvent) => {
        if (event.instance.textChannel) {
            await sendMessage(event.instance.textChannel, undefined, {
                embeds: [EMBEDS.MUSIC_ERROR(data, locale, event.error)]
            });
        }
    });

    instance.events.on('disconnect', async (event: VoiceDisconnectedEvent) => {
        if (event.instance.textChannel) {
            await sendMessage(event.instance.textChannel, undefined, {
                embeds: [EMBEDS.VOICECHANNEL_DISCONNECTED(data, locale)]
            });
        }

        DiscordMusicPlayer.destoryGuildInstance(event.instance.voiceChannel.guildId);
    });
}

export default class Join extends DiscordModule {
    public id = 'Discord_MusicPlayer_Join';
    public commands = ['join', 'summon'];
    public commandInteractionName = 'join';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        const member = data.getMember();

        if (!guild || !member) return;

        const locale = await Locale.getGuildLocale(guild.id);
        const voiceChannel = member.voice.channel;

        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data, locale)]
            });

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        await joinVoiceChannelProcedure(data, instance, voiceChannel);
    }
}
