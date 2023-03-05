import { Message, CommandInteraction, Interaction } from 'discord.js';
import { I18n } from 'i18n';

import DiscordMusicPlayer from '../../providers/DiscordMusicPlayer';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeSuccessEmbed,
    makeInfoEmbed,
    makeErrorEmbed,
    sendHybridInteractionMessageResponse
} from '../../utils/DiscordMessage';
import Locale from '../../services/Locale';

const EMBEDS = {
    RESUMED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_resume.resumed'),
            user: data.getUser()
        });
    },
    NOT_PAUSED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('musicplayer_resume.not_paused'),
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
};

export default class Resume extends DiscordModule {
    public id = 'Discord_MusicPlayer_Resume';
    public commands = ['resume'];
    public commandInteractionName = 'resume';

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

        if (!instance)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)]
            });

        if (instance.voiceChannel.id !== voiceChannel.id)
            return await sendHybridInteractionMessageResponse(
                data,
                { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data, locale)] },
                true
            );

        if (instance.queue.track.length === 0)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)]
            });

        if (!instance.isPaused())
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NOT_PAUSED(data, locale)] });

        instance.resumePlayer();
        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.RESUMED(data, locale)] });
    }
}
