import { I18n } from "i18n";
import { Message, CommandInteraction } from "discord.js";

import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";
import Locale from "../../services/Locale";

import { makeSuccessEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

const EMBEDS = {
    VOICECHANNEL_LEFT: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_leave.success'),
            user: data.getUser()
        });
    },
    USER_NOT_IN_VOICECHANNEL: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.not_in_voice'),
            user: data.getUser()
        });
    },
    NO_MUSIC_PLAYING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.no_music_playing'),
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

export default class Leave extends DiscordModule {
    
    public id = "Discord_MusicPlayer_Leave";
    public commands = ["leave", "disconnect", "dc"];
    public commandInteractionName = "leave";

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

        const locale = await Locale.getGuildLocale(guild.id);
        const voiceChannel = member.voice.channel;

        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data, locale)] });
              
        let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if(!instance)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)] });

        if(instance.voiceChannel.id !== voiceChannel.id)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data, locale)] });
        

        DiscordMusicPlayer.destoryGuildInstance(guild.id);
        await sendHybridInteractionMessageResponse(data, { embeds:[EMBEDS.VOICECHANNEL_LEFT(data, locale)] });

        return;
    }
}