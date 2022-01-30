import { Message, CommandInteraction, Interaction, VoiceChannel, MessageActionRow, Permissions, DMChannel, TextChannel } from "discord.js";
import { makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Environment from "../../providers/Environment";
import DiscordMusicPlayer, { ValidTracks } from "../../providers/DiscordMusicPlayer";
import Prisma from "../../providers/Prisma";
import { joinVoiceChannelProcedure } from "./Join";

const EMBEDS = {
    YOUTUBE_ONLY: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `Only youtube.com link is supported for now`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_LINK: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `Invalid Link`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ADDED_QUEUE: (data: Message | Interaction, track: ValidTracks) => {
        let embed = makeSuccessEmbed({
            title: `Song added to queue!`,
            description: `${track.title}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
        embed.setImage(track.thumbnails[0].url);
        return embed;
    },
    USER_NOT_IN_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You need to be in the voice channel first!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_IN_SAME_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You are not in the same voice channel!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
}


export default class Play {

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'play' && command.toLowerCase() !== 'p') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: Interaction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'play') return;
            await this.process(interaction, interaction.options);
        }
        else if (interaction.isSelectMenu()) {
            if(!interaction.guild || !interaction.guildId) return;
            if (!this.tryParseJSONObject(interaction.customId)) return;

            let payload = JSON.parse(interaction.customId);
            if(!interaction.member?.user?.id) return;

            /*
                Discord have 100 char custom id char limit
                So we need to shorten our json.
                MP_SM stands for MusicPlayer_SearchMenu
                data.r stands for data.requester
                data.v stands for data.voiceChannel
            */
            if (typeof payload.module === 'undefined' ||
                typeof payload.action === 'undefined' ||
                payload.module !== 'MP_SM' ||
                payload.action !== 'play') return;
            
            await interaction.deferReply();

            let voiceChannel = DiscordProvider.client.guilds.cache.get(interaction.guildId)?.channels.cache.get(payload.data.v);
            let member = DiscordProvider.client.guilds.cache.get(interaction.guildId)?.members.cache.get(interaction.member?.user?.id);

            if(!member) return;
            if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) return;


            if (!member.voice.channel)
                return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(interaction)] }, true);

            if (!DiscordMusicPlayer.isGuildInstanceExists(interaction.guildId)) {
                await joinVoiceChannelProcedure(interaction, null, voiceChannel);
            }

            let instance = DiscordMusicPlayer.getGuildInstance(interaction.guildId);

            if(instance!.voiceChannel.id !== member.voice.channel.id)
                return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(interaction)] }, true);

            if (!instance!.isConnected()) {
                await joinVoiceChannelProcedure(interaction, instance!, voiceChannel);
                instance = DiscordMusicPlayer.getGuildInstance(interaction.guildId);
            }

            if (!instance) return;

            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(DiscordMusicPlayer.parseYouTubeLink(interaction.values[0]));
            if (!result) return;

            instance.addTrackToQueue(result);
            //interaction.editReply({ embeds: [EMBEDS.ADDED_QUEUE(interaction, result)] });
            return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.ADDED_QUEUE(interaction, result)] }, true);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        if (!data.member) return;
        if (!data.guild) return;
        if (!data.guildId) return;

        let query;

        if (isMessage) {
            if (data === null || !data.guildId || data.member === null || data.guild === null) return;

            if (args.length === 0) {
                // TODO: Show info
                //return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.MSINFO(data)] });
                return;
            }
            query = args[0];

        }
        else if (isSlashCommand) {
            query = args.getSubcommand();
        }

        if (!query) return;
        if (!(data.channel instanceof TextChannel)) return;

        if (!data.member.voice.channel)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data)] });

        let voiceChannel = data.member.voice.channel;

        if (!DiscordMusicPlayer.isGuildInstanceExists(data.guildId)) {
            await joinVoiceChannelProcedure(data, null, voiceChannel);
        }

        let instance = DiscordMusicPlayer.getGuildInstance(data.guildId);

        if(instance!.voiceChannel.id !== data.member.voice.channel.id)
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data)] }, true);

        if (!instance!.isConnected()) {
            await joinVoiceChannelProcedure(data, instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        }

        if (!instance) return;

        if (DiscordMusicPlayer.isYouTubeLink(query)) {
            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(DiscordMusicPlayer.parseYouTubeLink(query));

            if (!result) return;

            if (isMessage && (data as Message).embeds.length > 0) {
                (data as Message).suppressEmbeds(true);
            }

            instance.addTrackToQueue(result);
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data, result)] });
        } else {
            let result = await DiscordMusicPlayer.searchYouTubeByQuery(query);

            if (!result) return;
            instance.addTrackToQueue(result[0]);

            // TODO: Let user choose the video
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data, result[0])] });
        }

        return;
    }

    tryParseJSONObject(jsonString: string) {
        try {
            let o = JSON.parse(jsonString);
            if (o && typeof o === "object") {
                return true;
                //return o;
            }
        }
        catch (e) { }

        return false;
    }


}