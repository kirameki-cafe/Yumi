import { Message, CommandInteraction, Interaction, VoiceChannel, MessageActionRow, Permissions, DMChannel, TextChannel, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import { makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Environment from "../../providers/Environment";
import DiscordMusicPlayer, { ValidTracks } from "../../providers/DiscordMusicPlayer";
import Prisma from "../../providers/Prisma";
import { joinVoiceChannelProcedure } from "./Join";

const EMBEDS = {
    SEARCH_RESULT: (data: Message | Interaction, result: ValidTracks[]) => {
        return makeInfoEmbed({
            title: `Search result`,
            description: `${result.length} results found\n\n${result.map(track => `- [${track.title}](${track.url})`).join('\n')}`,
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
    }
}


export default class Search {

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'search') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'search') return;
            await this.process(interaction, interaction.options);
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
            query = args.join(' ');

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
        
        if (instance!.voiceChannel.id !== voiceChannel.id)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data)] });

        if (!instance!.isConnected()) {
            await joinVoiceChannelProcedure(data, instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        }

        if (!instance) return;

        let result = await DiscordMusicPlayer.searchYouTubeByQuery(query);

        if (!result) return;

        const menuOptions: MessageSelectOptionData[] = [];
        
        const messageSelectMenu = new MessageSelectMenu();
        /*
            Discord have 100 char custom id char limit
            So we need to shorten our json.
            MP_SM stands for MusicPlayer_SearchMenu
            data.r stands for data.requester
            data.v stands for data.voiceChannel
        */
        messageSelectMenu.setCustomId(JSON.stringify({
            module: 'MP_SM',
            action: 'play',
            data: {
                r: data.member.id,
                v: voiceChannel.id
            }
        }))
        messageSelectMenu.setPlaceholder('Nothing selected');

        for(let song of result) {
            if(!song.title) continue;
            menuOptions.push({
                label: song.title,
                description: `${song.durationInSec} sec | ${song.views} views`,
                value: song.url
            });
        }

        messageSelectMenu.addOptions(menuOptions);

        const row = new MessageActionRow();
        row.addComponents(messageSelectMenu);

        await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SEARCH_RESULT(data, result)], components: [row] });

        return;
    }


}