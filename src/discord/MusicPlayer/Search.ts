import { Message, CommandInteraction, Interaction, MessageActionRow, ButtonInteraction, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import { I18n } from "i18n";

import { joinVoiceChannelProcedure } from "./Join";

import DiscordMusicPlayer, { ValidTracks } from "../../providers/DiscordMusicPlayer";
import Locale from "../../services/Locale";

import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";
import { makeErrorEmbed, makeSuccessEmbed, sendHybridInteractionMessageResponse, makeInfoEmbed } from "../../utils/DiscordMessage";

const EMBEDS = {
    SEARCH_INFO: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('musicplayer_search.title'),
            description: locale.__('musicplayer_search.info'),
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('musicplayer_search.valid_args'),
                }
            ],
            user: data.getUser()
        });
    },
    SEARCH_RESULT: (data: HybridInteractionMessage, locale: I18n, result: ValidTracks[]) => {
        return makeInfoEmbed({
            title: locale.__('musicplayer_search.title_result'),
            description: `${locale.__('musicplayer_search.x_results_found', result.length.toString())}\n\n${result.map(track => `- [${track.title}](${track.url})`).join('\n')}`,
            user: data.getUser()
        });
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
    }
}
export default class Search extends DiscordModule {

    public id = "Discord_MusicPlayer_Search";
    public commands = ["search"];
    public commandInteractionName = "search";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async GuildButtonInteractionCreate(interaction: ButtonInteraction) {
        if (!this.isJsonValid(interaction.customId)) return;
        const payload = JSON.parse(interaction.customId);

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

        await this.run(new HybridInteractionMessage(interaction), payload.d.q);
    }
    
    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();
        const user = data.getUser();
        const member = data.getMember();
        const channel = data.getChannel();

        if (!guild || !user || !member || !channel) return;
        const locale = await Locale.getGuildLocale(guild.id);

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SEARCH_INFO(data, locale)] });

            query = args.join(' ');
        }
        else if (data.isSlashCommand())
            query = args.getSubcommand();
        else if (data.isButton())
            query = args;

        if (!query) return;

        const voiceChannel = member.voice.channel;

        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data, locale)] });


        if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id))
            await joinVoiceChannelProcedure(data, null, voiceChannel);

        let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if (!instance) return;

        if (instance.voiceChannel.id !== voiceChannel.id)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data, locale)] });

        if (!instance.isConnected()) {
            await joinVoiceChannelProcedure(data, instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        }

        let result = await DiscordMusicPlayer.searchYouTubeByQuery(query);
        if (!result) return; // TODO: Handle when search returned nothing

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
                r: user.id,
                v: voiceChannel.id
            }
        }))
        messageSelectMenu.setPlaceholder('Nothing selected');

        for (let song of result) {
            if (!song.title) continue;
            menuOptions.push({
                label: song.title,
                description: `${song.durationInSec} sec | ${song.views} views`,
                value: song.url
            });
        }

        messageSelectMenu.addOptions(menuOptions);

        const row = new MessageActionRow();
        row.addComponents(messageSelectMenu);

        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SEARCH_RESULT(data, locale, result)], components: [row] });
    }


    isJsonValid(jsonString: string) {
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