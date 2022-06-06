import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction, VoiceChannel, Permissions, GuildMember, DMChannel, StageChannel, MessageActionRow, MessageButton, TextChannel, VoiceBasedChannel } from "discord.js";
import { makeSuccessEmbed, makeErrorEmbed, sendMessage, sendHybridInteractionMessageResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer, { PlayerPlayingEvent, PlayerErrorEvent, VoiceDisconnectedEvent, ValidTracks, DiscordMusicPlayerInstance, DiscordMusicPlayerLoopMode } from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    VOICECHANNEL_JOINED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Success`,
            description: `Joined voice channel`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    VOICECHANNEL_DISCONNECTED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Disconnected`,
            description: `I got disconnected from the voice channel`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    VOICECHANNEL_INUSE: (data: Message | Interaction) => {

        let haveForceMove = (data instanceof Message) ? (data as Message).member!.permissions.has([Permissions.FLAGS.MOVE_MEMBERS]) : ((data as Interaction).member! as GuildMember).permissions.has([Permissions.FLAGS.MOVE_MEMBERS]);

        return makeErrorEmbed({
            title: `I can't open portal to parallel universe`,
            description: `I can't join mutiple voice channel on the same guild.
            I wish I had a superpower, maybe... one day I will.
            
            There are also somebody listening to the music in the voice channel I'm currently in.${!haveForceMove ? ` Wait until I finish playing there or I'm alone there. Better yet, join them!` : " Wait until I finish playing there or I'm alone there. Better yet, join them! \n\n**Or... just (ab)use your admin permissions and move me to where you want!**"}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    VOICECHANNEL_ALREADY_JOINED: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: `I'm already here`,
            description: `Already in the voice channel you are currently connected to`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_IN_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You need to be in the voice channel first!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    MUSIC_ERROR: (data: Message | Interaction, err: Error) => {
        return makeErrorEmbed({
            title: `Error while playing music, skipping this track`,
            description: `${err.message}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NOW_PLAYING: (data: Message | Interaction, track: ValidTracks) => {
        const embed = makeInfoEmbed({
            title: ' Now playing',
            icon: '🎵',
            description: `${track.title}`,
            user: DiscordProvider.client.user
        });

        const highestResolutionThumbnail = track.thumbnails.reduce((prev, current) => (prev.height * prev.width > current.height * current.width) ? prev : current)

        if(highestResolutionThumbnail)
            embed.setImage(highestResolutionThumbnail.url);

        return embed;
    },
    NOW_REPEATING: (data: Message | Interaction, track: ValidTracks) => {
        const embed = makeInfoEmbed({
            title: ' Now playing (Repeating)',
            icon: '🎵',
            description: `${track.title}`,
            user: DiscordProvider.client.user
        });

        const highestResolutionThumbnail = track.thumbnails.reduce((prev, current) => (prev.height * prev.width > current.height * current.width) ? prev : current)

        if(highestResolutionThumbnail)
            embed.setImage(highestResolutionThumbnail.url);

        return embed;
    }
}

export async function joinVoiceChannelProcedure (data: HybridInteractionMessage, instance: (DiscordMusicPlayerInstance | null), voiceChannel: (VoiceChannel | StageChannel)) {

    const isSlashCommand = data.isSlashCommand();
    const isAcceptableInteraction = data.isSelectMenu() || data.isButton();
    const isMessage = data.isMessage();
    if ((!isSlashCommand && !isAcceptableInteraction) && !isMessage) return;

    const member = data.getMember();
    const channel = data.getChannel();
    const guild = data.getGuild();

    if(!member || !channel || !guild) return;

    if (channel instanceof DMChannel) return;
    if (!(channel instanceof TextChannel)) return;

    const memberVoiceChannel = member.voice.channel;//isMessage ? member.voice.channel : DiscordProvider.client.guilds.cache.get(guild.id)!.members.cache.get((data as Interaction).user.id)?.voice.channel;
    if (!memberVoiceChannel) return;

    const bot = guild.me;
    if(!bot) return;

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
            if(!isAcceptableInteraction)
                await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data.getRaw())] });
        }
        // And, already have instance on the guild
        else {
            // And, User VoiceChannel is same as the instance
            if (channel.id === instance.voiceChannel.id) {
                if(!isAcceptableInteraction)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.VOICECHANNEL_ALREADY_JOINED(data.getRaw())] });
                else return;
            }
            // But, not the same VoiceChannel
            else {
                let activeMembers = instance.voiceChannel.members.filter(member => member.user.bot === false);
                // And someone else is using the bot
                if(activeMembers.size > 0) {
                    if(!isAcceptableInteraction)
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.VOICECHANNEL_INUSE(data.getRaw())] });
                    else return;
                }
                // And alone in the VoiceChannel
                else {
                    // Move to the new voice channel
                    await bot.voice.setChannel(voiceChannel);
                    if(!isAcceptableInteraction)
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data.getRaw())] });
                    else return;
                }
            }
        }

    }
    // Not in any VoiceChannel
    else {

        if (instance)
            await DiscordMusicPlayer.destoryGuildInstance(guild.id);

        DiscordMusicPlayer.createGuildInstance(guild.id, voiceChannel);
        instance = DiscordMusicPlayer.getGuildInstance(guild.id);

        instance!.joinVoiceChannel(voiceChannel, channel);
        if(!isAcceptableInteraction)
            await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data.getRaw())] });
    }

    if (!instance) return;

    let previousTrack: ValidTracks | undefined;
    let isLoopMessageSent = false;

    // Register Event Listeners
    instance.events.on('playing', async (event: PlayerPlayingEvent) => {

        if(!event.instance.queue || !event.instance.queue.track || event.instance.queue.track.length === 0) return;
        previousTrack = event.instance.getPreviousTrack();

        if(event.instance.queue.track[0] !== previousTrack)
            isLoopMessageSent = false;
        else if(event.instance.queue.track[0] === previousTrack && isLoopMessageSent) return;

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setEmoji('▶️')
                    .setLabel(' Open on YouTube')
                    .setURL(encodeURI(`https://www.youtube.com/watch?v=${event.instance.queue.track[0].id}`))
                    .setStyle('LINK'),
            )

        if (event.instance.textChannel) {
            if(event.instance.getLoopMode() === DiscordMusicPlayerLoopMode.Current) {
                isLoopMessageSent = true;
                await sendMessage(event.instance.textChannel, undefined, { embeds: [EMBEDS.NOW_REPEATING(data.getRaw(), event.instance.queue.track[0])], components: [row] });
            }
            else {
                await sendMessage(event.instance.textChannel, undefined, { embeds: [EMBEDS.NOW_PLAYING(data.getRaw(), event.instance.queue.track[0])], components: [row] });
            }
        }
    });

    instance.events.on('error', async (event: PlayerErrorEvent) => {
        if (event.instance.textChannel) {
            await sendMessage(event.instance.textChannel, undefined, { embeds: [EMBEDS.MUSIC_ERROR(data.getRaw(), event.error)] });
        }
    });

    instance.events.on('disconnect', async (event: VoiceDisconnectedEvent) => {
        if (event.instance.textChannel) {
            await sendMessage(event.instance.textChannel, undefined, { embeds: [EMBEDS.VOICECHANNEL_DISCONNECTED(data.getRaw())] });
        }

        DiscordMusicPlayer.destoryGuildInstance(event.instance.voiceChannel.guildId);
    });
}

export default class Join extends DiscordModule {

    public id = "Discord_MusicPlayer_Join";
    public commands = ["join"];
    public commandInteractionName = "join";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) { 
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();
        const member = data.getMember();

        if(!guild || !member) return;

        const voiceChannel = member.voice.channel;

        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data.getRaw())] });
        
        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        console.log(data.isButton)
        await joinVoiceChannelProcedure(data, instance, voiceChannel);
    }
}