import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction } from "discord.js";
import { makeSuccessEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";

import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";
import { I18n } from "i18n";
import Locale from "../../services/Locale";

const EMBEDS = {
    SKIPPED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_skip.skipped'),
            user: data.getUser()
        });
    },
    SKIPPED_LASTSONG: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_skip.skipped_last_song'),
            user: data.getUser()
        });
    },
    NO_MUSIC_PLAYING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.no_music_playing'),
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

export default class Skip extends DiscordModule{

    public id = "Discord_MusicPlayer_Skip";
    public commands = ["skip"];
    public commandInteractionName = "skip";

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
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data, locale)] });

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);

        if(!instance)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)] });

        if(instance.voiceChannel.id !== voiceChannel.id)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data, locale)] }, true);

        if(instance.queue.track.length === 0)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)] });

        instance.skipTrack();

        if(instance.queue.track.length === 0)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SKIPPED_LASTSONG(data, locale)] });
        else
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SKIPPED(data, locale)] });
    }
}