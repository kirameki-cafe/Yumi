import { Message, CommandInteraction } from 'discord.js';
import { I18n } from 'i18n';

import DiscordMusicPlayer, { DiscordMusicPlayerInstance, TrackUtils } from '../../providers/DiscordMusicPlayer';
import Locale from '../../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeErrorEmbed,
    sendHybridInteractionMessageResponse,
    makeSuccessEmbed,
    makeInfoEmbed
} from '../../utils/DiscordMessage';
import { LoopMode } from '../../../NekoMelody/src/player';

const EMBEDS = {
    QUEUE: (data: HybridInteractionMessage, locale: I18n, instance: DiscordMusicPlayerInstance) => {
        const queue = instance.nekoPlayer.getQueue();
        const current = instance.nekoPlayer.getCurrentAudioInformation();

        if (!current)
            return makeInfoEmbed({
                title: locale.__('musicplayer_queue.title'),
                description: locale.__('musicplayer_queue.empty'),
                user: data.getUser()
            });

        const nowPlayingText = `${
            instance.nekoPlayer.getLoopMode() === LoopMode.Current
                ? ` ${locale.__('musicplayer_queue.looping_current')}`
                : ''
        }: [${current.metadata.title}](${current.metadata.url})`;

        let description;
        if (queue.length == 0) {
            let queueString = `1. [${current.metadata.title}](${current.metadata.url})`;
            description = `${locale.__('musicplayer_queue.now_playing')}${nowPlayingText}\n
            ${locale.__('musicplayer_queue.empty')}`;
        } else if (queue.length >= 10) {
            const upcomingText = `[${queue[0].metadata.title}](${queue[0].metadata.url})`;
            const first10 = queue.slice(0, 10);
            let queueString = first10
                .map((track, index) => `${index + 1}. [${track.metadata.title}](${track.metadata.url})`)
                .join('\n');
            description = `${locale.__('musicplayer_queue.now_playing')}${nowPlayingText}
                ${locale.__('musicplayer_queue.upcoming_song')} ${upcomingText}\n
                ${locale.__('musicplayer_queue.song_x_in_queue', { COUNT: queue.length.toString() })}
                ${queueString}\n${queue.length > 10 ? `...${queue.length - 10} more songs` : ''}`;
        } else {
            const upcomingText = `[${queue[0].metadata.title}](${queue[0].metadata.url})`;
            const queueString = queue
                .map((track, index) => `${index + 1}. [${track.metadata.title}](${track.metadata.url})`)
                .join('\n');
            description = `${locale.__('musicplayer_queue.now_playing')}${nowPlayingText}
                ${locale.__('musicplayer_queue.upcoming_song')} ${upcomingText}\n
                ${locale.__('musicplayer_queue.song_x_in_queue', { COUNT: queue.length.toString() })}
                ${queueString}`;
        }

        return makeInfoEmbed({
            title: locale.__('musicplayer_queue.title'),
            description: description,
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('musicplayer_queue.valid_args')
                }
            ],
            user: data.getUser()
        });
    },
    QUEUE_CLEARED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_queue.cleared'),
            user: data.getUser()
        });
    },
    QUEUE_SHUFFLED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('musicplayer_queue.shuffled'),
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

export default class QueueCommand extends DiscordModule {
    public id = 'Discord_MusicPlayer_Queue';
    public commands = ['queue', 'q'];
    public commandInteractionName = 'queue';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        if (!guild) return;

        let query;
        const locale = await Locale.getGuildLocale(guild.id);

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if (!instance)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)]
            });

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.QUEUE(data, locale, instance)]
                });

            query = args.join(' ');
        } else if (data.isApplicationCommand()) {
            //query = data.getSlashCommand().options.get('query', true).value?.toString();
        }

        if (!query) return;
        switch (query.toLowerCase()) {
            case 'clear':
                instance.clearQueue();
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.QUEUE_CLEARED(data, locale)]
                });
            case 'shuffle':
                instance.shuffleQueue();
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.QUEUE_SHUFFLED(data, locale)]
                });
        }
    }
}
