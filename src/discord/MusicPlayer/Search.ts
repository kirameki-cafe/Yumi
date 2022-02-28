import { Message, CommandInteraction, Interaction, MessageActionRow, TextChannel, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import { makeErrorEmbed, makeSuccessEmbed, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordMusicPlayer, { ValidTracks } from "../../providers/DiscordMusicPlayer";
import { joinVoiceChannelProcedure } from "./Join";

const EMBEDS = {
    SEARCH_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed ({
            title: 'Search',
            description: `Search for a song`,
            fields: [
                {
                    name: 'Arguments',
                    value: '``Search query``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
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

    async interactionCreate(interaction: Interaction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'search') return;
            await this.process(interaction, interaction.options);
        }
        else if (interaction.isButton()) {
            if(!interaction.guild || !interaction.guildId) return;
            if (!this.tryParseJSONObject(interaction.customId)) return;

            let payload = JSON.parse(interaction.customId);
            if(!interaction.member?.user?.id) return;

            /*
                Discord have 100 char custom id char limit
                So we need to shorten our json.
                MP_P stands for MusicPlayer_Search
                data.q stands for data.query
            */

            if (typeof payload.m === 'undefined' ||
                typeof payload.a === 'undefined' ||
                payload.m !== 'MP_S' ||
                payload.a !== 'search') return;

            await this.process(interaction, payload.d.q);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isButton = data instanceof Interaction && data.isButton();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage && !isButton) return;

        if (!data.member) return;
        if (!data.guild) return;
        if (!data.guildId) return;

        let query;

        if (isMessage) {
            if (data === null || !data.guildId || data.member === null || data.guild === null) return;

            if (args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SEARCH_INFO(data)] });
            }
            query = args.join(' ');

        }
        else if (isSlashCommand) {
            query = args.getSubcommand();
        }
        else if (isButton) {
            query = args;
        }

        if (!query) return;
        if (!(data.channel instanceof TextChannel)) return;

        let guildMember = data.member;

        if(isButton)
            guildMember = data.guild.members.cache.get(data.user.id)!

        if (!guildMember.voice.channel)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data)] });
        
        let voiceChannel = guildMember.voice.channel;

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
            m: 'MP_SM',
            a: 'play',
            d: {
                r: guildMember.id,
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