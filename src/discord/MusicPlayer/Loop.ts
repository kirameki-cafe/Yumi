import { I18n } from 'i18n';
import { Message, CommandInteraction } from 'discord.js';

import DiscordMusicPlayer from '../../providers/DiscordMusicPlayer';
import { LoopMode } from '../../../NekoMelody/src/index';
import Locale from '../../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeErrorEmbed,
    makeSuccessEmbed,
    sendHybridInteractionMessageResponse,
    makeInfoEmbed
} from '../../utils/DiscordMessage';
const EMBEDS = {
    INVALID_LOOP_MODE: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer_loop.invalid'),
            user: data.getUser()
        });
    },
    LOOP_STATUS: (data: HybridInteractionMessage, locale: I18n, loopMode: LoopMode) => {
        let embed = makeInfoEmbed({
            title: locale.__('musicplayer_loop.info', {
                MODE: loopMode
            }),
            description: locale.__('musicplayer_loop.valid_args'),
            user: data.getUser()
        });
        return embed;
    },
    LOOP_SET: (data: HybridInteractionMessage, locale: I18n, loopMode: LoopMode) => {
        let embed = makeSuccessEmbed({
            title: locale.__('musicplayer_loop.loop_set', {
                MODE: loopMode
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
    NO_MUSIC_PLAYING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.no_music_playing'),
            user: data.getUser()
        });
    }
};
export default class Loop extends DiscordModule {
    public id = 'Discord_MusicPlayer_Loop';
    public commands = ['loop', 'repeat'];
    public commandInteractionName = 'loop';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
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
            if (args.length !== 0) query = args.join(' ');
        } else if (data.isApplicationCommand()) query = args.getSubcommand();

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

        if (!instance.nekoPlayer.getCurrentAudioInformation())
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)]
            });

        if (!query)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.LOOP_STATUS(data, locale, instance.nekoPlayer.getLoopMode())]
            });

        let enumKey = Object.keys(LoopMode)[Object.values(LoopMode).indexOf(query.toLowerCase())];

        if (enumKey) {
            instance.nekoPlayer.setLoopMode(LoopMode[enumKey as keyof typeof LoopMode]);
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.LOOP_SET(data, locale, instance.nekoPlayer.getLoopMode())]
            });
        }

        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INVALID_LOOP_MODE(data, locale)] });
    }
}
