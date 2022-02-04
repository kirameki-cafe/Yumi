import { Message, CommandInteraction, Interaction, VoiceChannel, Permissions, GuildMember, DMChannel, StageChannel, MessageActionRow, MessageButton, MessageAttachment, TextChannel } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeErrorEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Users from "../../services/Users"
import Environment from "../../providers/Environment";
import DiscordMusicPlayer, { PlayerPlayingEvent, ValidTracks, DiscordMusicPlayerInstance } from "../../providers/DiscordMusicPlayer";
import Discord from "../../providers/Discord";

const EMBEDS = {
    VOICECHANNEL_JOINED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Success`,
            description: `Joined voice channel`,
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
    NOW_PLAYING: (data: Message | Interaction, track: ValidTracks) => {
        const embed = makeInfoEmbed({
            title: ' Now playing',
            icon: '🎵',
            description: `${track.title}`,
            user: DiscordProvider.client.user
        });

        embed.setImage(track.thumbnails[0].url);
        return embed;
    }
}

export async function joinVoiceChannelProcedure (data: Interaction | Message, instance: (DiscordMusicPlayerInstance | null), voiceChannel: (VoiceChannel | StageChannel)) {

    const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
    const isAcceptableInteraction = data instanceof Interaction && data.isSelectMenu();
    const isMessage = data instanceof Message;
    if ((!isSlashCommand && !isAcceptableInteraction) && !isMessage) return;

    if (!data.member) return;
    if (!data.channel) return;
    if (!data.guildId) return;

    if (data.channel instanceof DMChannel) return;
    if (!(data.channel instanceof TextChannel)) return;

    const channel: any = isMessage ? data.member.voice.channel : DiscordProvider.client.guilds.cache.get((data as Interaction).guildId!)!.members.cache.get((data as Interaction).user.id)?.voice.channel;
    if (!channel) return;


    // If already in VoiceChannel
    if (DiscordProvider.client.guilds.cache.get(data.guildId!)!.me!.voice.channelId) {
        // But, no music instance yet (The bot might just restarted)
        if (!instance) {
            // User is in different VoiceChannel
            if (channel.id !== DiscordProvider.client.guilds.cache.get(data.guildId)?.me?.voice) {
                //Disconnect it
                await DiscordProvider.client.guilds.cache.get(data.guildId)?.me?.voice.disconnect();
            }

            //Create instance for a new one
            DiscordMusicPlayer.createGuildInstance(data.guildId, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(data.guildId);

            instance!.joinVoiceChannel(voiceChannel, data.channel);
            if(!isAcceptableInteraction)
                await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data)] });
        }
        // And, already have instance on the guild
        else {
            // And, User VoiceChannel is same as the instance
            if (channel.id === instance.voiceChannel.id) {
                if(!isAcceptableInteraction)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.VOICECHANNEL_ALREADY_JOINED(data)] });
                else return;
            }
            // But, not the same VoiceChannel
            else {
                let activeMembers = instance.voiceChannel.members.filter(member => member.user.bot === false);
                // And someone else is using the bot
                if(activeMembers.size > 0) {
                    if(!isAcceptableInteraction)
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.VOICECHANNEL_INUSE(data)] });
                    else return;
                }
                // And alone in the VoiceChannel
                else {
                    // Move to the new voice channel
                    await DiscordProvider.client.guilds.cache.get(data.guildId)?.me?.voice.setChannel(voiceChannel);
                    if(!isAcceptableInteraction)
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data)] });
                    else return;
                }
            }
        }

    }
    // Not in any VoiceChannel
    else {

        if (instance)
            await DiscordMusicPlayer.destoryGuildInstance(data.guildId!);

        DiscordMusicPlayer.createGuildInstance(data.guildId, voiceChannel);
        instance = DiscordMusicPlayer.getGuildInstance(data.guildId);

        instance!.joinVoiceChannel(voiceChannel, data.channel);
        if(!isAcceptableInteraction)
            await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.VOICECHANNEL_JOINED(data)] });
    }

    if (!instance) return;

    let nowPlayingMessage: any;

    // Register Event Listeners
    instance.events.on('playing', async (event: PlayerPlayingEvent) => {

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setEmoji('▶️')
                    .setLabel(' Open on YouTube')
                    .setURL(encodeURI(`https://www.youtube.com/watch?v=${event.instance.queue.track[0].id}`))
                    .setStyle('LINK'),
            )

        if (event.instance.textChannel) {
            await sendMessage(event.instance.textChannel, undefined, { embeds: [EMBEDS.NOW_PLAYING(data, event.instance.queue.track[0])], components: [row] });
        }
    })
}

export default class Join {


    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'join') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'join') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        if (!data.member) return;

        this.joinCommands(data, args);

    }

    public async joinCommands(data: Interaction | Message, args: any) {

        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;
        if (!isSlashCommand && !isMessage) return;

        if (!data.member) return;
        if (!data.channel) return;
        if (!data.guildId) return;

        if (data.channel instanceof DMChannel) return;
        if (!(data.channel instanceof TextChannel)) return;

        const channel: any = isMessage ? data.member.voice.channel : DiscordProvider.client.guilds.cache.get((data as Interaction).guildId!)!.members.cache.get((data as Interaction).user.id)?.voice.channel;
        if (!channel) return;

        if (!data.member.voice.channel)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data)] });
        
        let voiceChannel = data.member.voice.channel;

       

        //if(!DiscordMusicPlayer.isGuildInstanceExists(data.guildId)) {
        //   DiscordMusicPlayer.createGuildInstance(data.guildId, voiceChannel);
        //}

        let instance = DiscordMusicPlayer.getGuildInstance(data.guildId);

        await joinVoiceChannelProcedure(data, instance!, voiceChannel);

        //if(!instance.isConnected())
        //    instance.joinVoiceChannel(voiceChannel, data.channel ? data.channel : undefined);


    }
}