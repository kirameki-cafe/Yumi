import {
    Message,
    CommandInteraction,
    VoiceChannel,
    ActionRowBuilder,
    ButtonBuilder,
    SelectMenuInteraction,
    ButtonInteraction,
    StageChannel,
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';
import { I18n } from 'i18n';

import { joinVoiceChannelProcedure } from './Join';

import DiscordProvider from '../../providers/Discord';
import DiscordMusicPlayer, { TrackUtils, ValidTracks } from '../../providers/DiscordMusicPlayerTempFix';
import Locale from '../../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeErrorEmbed,
    makeSuccessEmbed,
    sendHybridInteractionMessageResponse,
    makeInfoEmbed
} from '../../utils/DiscordMessage';
import { checkBotPermissionsInChannel } from '../../utils/DiscordPermission';

const EMBEDS = {
    PLAY_INFO: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('musicplayer_play.title'),
            description: locale.__('musicplayer_play.info'),
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('musicplayer_play.valid_args')
                }
            ],
            user: data.getUser()
        });
    },
    ADDED_QUEUE: async (data: HybridInteractionMessage, locale: I18n, track: ValidTracks) => {
        const title = TrackUtils.getTitle(track);
        const thumbnails = await TrackUtils.getThumbnails(track);

        let embed = makeSuccessEmbed({
            title: locale.__('musicplayer_play.queue_added_song'),
            description: title,
            user: data.getUser()
        });

        if (TrackUtils.getHighestResolutionThumbnail(thumbnails))
            embed.setImage(TrackUtils.getHighestResolutionThumbnail(thumbnails).url);

        return embed;
    },
    ADDED_SONGS_QUEUE: (data: HybridInteractionMessage, locale: I18n, track: ValidTracks[]) => {
        let embed = makeSuccessEmbed({
            title: locale.__('musicplayer_play.queue_added_songs'),
            description: locale.__('musicplayer_play.queue_added_songs_description', {
                COUNT: track.length.toString()
            }),
            user: data.getUser()
        });
        return embed;
    },
    USER_NOT_IN_VOICECHANNEL: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.not_in_voice'),
            user: data.getUser()
        });
    },
    USER_NOT_IN_SAME_VOICECHANNEL: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.different_voice_channel'),
            user: data.getUser()
        });
    },
    LOOKUP_ERROR: (data: HybridInteractionMessage, locale: I18n, error: Error) => {
        let errorMessage = '';

        if (error.message === 'While getting info from url\nPrivate video') errorMessage = 'This is a private video';
        else
            errorMessage = error.message
                .replace('While getting info from url\n', '')
                .replace('While getting info from url', '');

        return makeErrorEmbed({
            title: locale.__('musicplayer_play.error'),
            description: errorMessage,
            user: data.getUser()
        });
    },
    TOO_LONG: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer_play.too_long'),
            user: data.getUser()
        });
    }
};
export default class Play extends DiscordModule {
    public id = 'Discord_MusicPlayer_Play';
    public commands = ['play', 'p'];
    public commandInteractionName = 'play';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async GuildButtonInteractionCreate(interaction: ButtonInteraction) {
        const hybridData = new HybridInteractionMessage(interaction);
        const guild = hybridData.getGuild();
        const member = hybridData.getMember();
        const user = hybridData.getUser();

        if (!guild || !member || !user) return;
        if (!this.isJSONValid(interaction.customId)) return;

        const locale = await Locale.getGuildLocale(guild.id);

        let payload = JSON.parse(interaction.customId);

        if (typeof payload.m === 'undefined' || typeof payload.a === 'undefined') return;

        /*
            Discord have 100 char custom id char limit
            So we need to shorten our json.
            MP_P stands for MusicPlayer_Play
            data.v stands for data.videoId
            data.l stands for data.listId
        */

        if (payload.m === 'MP_P' && payload.a === 'arp') {
            if (typeof payload.d === 'undefined') return;

            let data = payload.d.split('$');
            if (data.length !== 3) return;

            payload.d = {
                c: data[0],
                v: data[1],
                l: data[2]
            };

            await interaction.deferReply();

            let voiceChannel = DiscordProvider.client.guilds.cache.get(guild.id)?.channels.cache.get(payload.d.c);
            //let member = DiscordProvider.client.guilds.cache.get(guild.id)?.members.cache.get(interaction.member?.user?.id);

            if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) return;

            if (!member.voice.channel)
                return await sendHybridInteractionMessageResponse(
                    hybridData,
                    { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(hybridData, locale)] },
                    true
                );

            if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id))
                await joinVoiceChannelProcedure(new HybridInteractionMessage(interaction), null, voiceChannel);

            let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
            if (!instance) return;

            if (instance!.voiceChannel.id !== member.voice.channel.id)
                return await sendHybridInteractionMessageResponse(
                    hybridData,
                    { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(hybridData, locale)] },
                    true
                );

            if (!instance!.isConnected()) {
                await joinVoiceChannelProcedure(new HybridInteractionMessage(interaction), instance!, voiceChannel);
                instance = DiscordMusicPlayer.getGuildInstance(guild.id);
            }

            if (!instance) return;

            let playlist = await DiscordMusicPlayer.getYouTubeSongsInPlayList(
                `https://www.youtube.com/watch?v=${payload.d.v}&list=${payload.d.l}`
            );
            const songs = (await playlist.all_videos()).filter((song) => {
                return payload.d.v !== song.id;
            });

            for (let song of songs) {
                instance.addTrackToQueue(song);
            }

            if (hybridData.getStringSelectMenu().message instanceof Message)
                await (hybridData.getStringSelectMenu().message as Message).edit({ components: [] });

            return await sendHybridInteractionMessageResponse(
                hybridData,
                { embeds: [EMBEDS.ADDED_SONGS_QUEUE(hybridData, locale, songs)] },
                true
            );
        }
    }

    async GuildSelectMenuInteractionCreate(interaction: SelectMenuInteraction) {
        const hybridData = new HybridInteractionMessage(interaction);
        const guild = hybridData.getGuild();
        const member = hybridData.getMember();
        const user = hybridData.getUser();

        if (!guild || !member || !user) return;
        if (!this.isJSONValid(interaction.customId)) return;

        const locale = await Locale.getGuildLocale(guild.id);
        let payload = JSON.parse(interaction.customId);

        /*
            Discord have 100 char custom id char limit
            So we need to shorten our json.
            MP_SM stands for MusicPlayer_SearchMenu
            data.r stands for data.requester
            data.v stands for data.voiceChannel
        */
        if (typeof payload.m === 'undefined' || typeof payload.a === 'undefined') return;

        if (payload.m === 'MP_SM' && payload.a === 'play') {
            await interaction.deferReply();

            const voiceChannel = DiscordProvider.client.guilds.cache.get(guild.id)?.channels.cache.get(payload.d.v);
            //let member = DiscordProvider.client.guilds.cache.get(guild.id)?.members.cache.get(user.id);

            if (!voiceChannel || !(voiceChannel instanceof VoiceChannel || voiceChannel instanceof StageChannel))
                return;

            if (!member.voice.channel)
                return await sendHybridInteractionMessageResponse(
                    hybridData,
                    { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(new HybridInteractionMessage(interaction), locale)] },
                    true
                );

            if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id))
                await joinVoiceChannelProcedure(new HybridInteractionMessage(interaction), null, voiceChannel);

            let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
            if (!instance) return;

            if (instance!.voiceChannel.id !== member.voice.channel.id)
                return await sendHybridInteractionMessageResponse(
                    hybridData,
                    {
                        embeds: [
                            EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(new HybridInteractionMessage(interaction), locale)
                        ]
                    },
                    true
                );

            if (!instance!.isConnected()) {
                await joinVoiceChannelProcedure(new HybridInteractionMessage(interaction), instance!, voiceChannel);
                instance = DiscordMusicPlayer.getGuildInstance(guild.id);
            }

            if (!instance) return;

            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(
                DiscordMusicPlayer.parseYouTubeLink(interaction.values[0])
            ).catch((err) => {
                sendHybridInteractionMessageResponse(
                    hybridData,
                    { embeds: [EMBEDS.LOOKUP_ERROR(hybridData, locale, err)] },
                    true
                );
                return null;
            });
            if (!result) return;

            instance.addTrackToQueue(result);
            return await sendHybridInteractionMessageResponse(
                hybridData,
                { embeds: [await EMBEDS.ADDED_QUEUE(new HybridInteractionMessage(interaction), locale, result)] },
                true
            );
        }
    }

    async run(data: HybridInteractionMessage, args: any) {
        let query;
        const guild = data.getGuild();
        const channel = data.getGuildChannel();
        const member = data.getMember();

        if (!guild || !channel || !member) return;

        const locale = await Locale.getGuildLocale(guild.id);

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PLAY_INFO(data, locale)] });

            query = args.join(' ');
        } else if (data.isApplicationCommand()) {
            query = data.getSlashCommand().options.get('query', true).value?.toString();
        }

        if (!query) return;

        if (!member.voice.channel)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data, locale)]
            });

        const voiceChannel = member.voice.channel;

        if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id)) {
            await joinVoiceChannelProcedure(data, null, voiceChannel);
        }

        let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if (!instance) return;

        if (instance!.voiceChannel.id !== member.voice.channel.id)
            return await sendHybridInteractionMessageResponse(
                data,
                { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data, locale)] },
                true
            );

        if (!instance!.isConnected()) {
            await joinVoiceChannelProcedure(data, instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        }

        if (!instance) return;

        if (DiscordMusicPlayer.isYouTubeLink(query)) {
            let linkData = DiscordMusicPlayer.parseYouTubeLink(query);

            if (linkData.videoId === '' && linkData.list) {
                let playlist = await DiscordMusicPlayer.getYouTubeSongsInPlayList(query);
                const songs = await playlist.all_videos();

                for (let song of songs) {
                    instance.addTrackToQueue(song);
                }
                return await sendHybridInteractionMessageResponse(
                    data,
                    { embeds: [EMBEDS.ADDED_SONGS_QUEUE(data, locale, songs)] },
                    true
                );
            }

            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(linkData).catch((err) => {
                sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.LOOKUP_ERROR(data, locale, err)] }, true);
                return null;
            });

            if (!result) return;

            if (
                data.isMessage() &&
                data.getMessage().embeds.length > 0 &&
                (await checkBotPermissionsInChannel({
                    guild,
                    channel,
                    permissions: [PermissionsBitField.Flags.ManageMessages]
                }))
            ) {
                data.getMessage().suppressEmbeds(true);
            }

            instance.addTrackToQueue(result);

            if (linkData.list) {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
                    new ButtonBuilder()
                        .setEmoji('✅')
                        .setCustomId(
                            JSON.stringify({
                                m: 'MP_P',
                                a: 'arp', // Add remaining playlist
                                d: `${voiceChannel.id}$${linkData.videoId}$${linkData.list}`
                            })
                        )
                        .setLabel('  Add the remaining songs in the playlist')
                        .setStyle(ButtonStyle.Primary)
                ]);

                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result)],
                    components: [row]
                });
            } else
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result)]
                });
        } else if (DiscordMusicPlayer.isSpotifyLink(query)) {
            let linkData = DiscordMusicPlayer.parseSpotifyLink(query);

            if (linkData.type === 'playlist' || linkData.type === 'album') {
                let playlist = await DiscordMusicPlayer.getSpotifySongsInPlayList(query).catch((err) => {
                    sendHybridInteractionMessageResponse(
                        data,
                        { embeds: [EMBEDS.LOOKUP_ERROR(data, locale, err)] },
                        true
                    );
                    return null;
                });

                if (!playlist) return;
                const songs = await playlist.all_tracks();

                for (const song of songs) {
                    instance.addTrackToQueue(song);
                }

                return await sendHybridInteractionMessageResponse(
                    data,
                    { embeds: [EMBEDS.ADDED_SONGS_QUEUE(data, locale, songs)] },
                    true
                );
            }

            let result = await DiscordMusicPlayer.searchSpotifyBySpotifyLink(linkData).catch((err) => {
                sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.LOOKUP_ERROR(data, locale, err)] }, true);
                return null;
            });

            if (!result) return;

            if (
                data.isMessage() &&
                data.getMessage().embeds.length > 0 &&
                (await checkBotPermissionsInChannel({
                    guild,
                    channel,
                    permissions: [PermissionsBitField.Flags.ManageMessages]
                }))
            ) {
                data.getMessage().suppressEmbeds(true);
            }

            instance.addTrackToQueue(result);

            return await sendHybridInteractionMessageResponse(data, {
                embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result)]
            });
        } else {
            let result = await DiscordMusicPlayer.searchYouTubeByQuery(query);

            if (!result) {
                // TODO: Send not found embed
                await sendHybridInteractionMessageResponse(
                    data,
                    { embeds: [EMBEDS.LOOKUP_ERROR(data, locale, new Error('Cannot find that song'))] },
                    true
                );
                return;
            }
            instance.addTrackToQueue(result[0]);

            // Max 1 hour
            if (result[0].durationInSec > 3600)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.TOO_LONG(data, locale)]
                });

            if (result.length > 1) {
                // TODO: Find a better logic than this
                // If the first result title is exact match with the query or first title contains half the space of the query, it's probably a sentence
                // then we don't need to show the search results
                // if(result[0].title === query || result[0].title && (Math.ceil((result[0].title.split(" ").length - 1) / 2) === Math.ceil((query.split(" ").length - 1) / 2))) return;

                // The query length is too long to fit in json
                if (query.length > 100 - 51) return;

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
                    new ButtonBuilder()
                        .setEmoji('🔎')
                        .setCustomId(
                            JSON.stringify({
                                m: 'MP_S',
                                a: 'search',
                                d: {
                                    q: query
                                }
                            })
                        )
                        .setLabel('  Not this? Search!')
                        .setStyle(ButtonStyle.Primary)
                ]);

                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result[0])],
                    components: [row]
                });
            }

            return await sendHybridInteractionMessageResponse(data, {
                embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result[0])]
            });
        }
    }

    isJSONValid(jsonString: string) {
        try {
            let o = JSON.parse(jsonString);
            if (o && typeof o === 'object') {
                return true;
            }
        } catch (e) {}
        return false;
    }
}
