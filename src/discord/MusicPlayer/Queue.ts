import { Message, CommandInteraction, Interaction, TextChannel } from 'discord.js';
import { I18n } from 'i18n';

import DiscordMusicPlayer, {
    DiscordMusicPlayerInstance,
    DiscordMusicPlayerLoopMode
} from '../../providers/DiscordMusicPlayer';
import Locale from '../../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeErrorEmbed, sendHybridInteractionMessageResponse, makeInfoEmbed } from '../../utils/DiscordMessage';

const EMBEDS = {
    QUEUE: (data: HybridInteractionMessage, locale: I18n, instance: DiscordMusicPlayerInstance) => {
        const queue = instance.queue;

        if (!queue.track[0])
            return makeInfoEmbed({
                title: locale.__('musicplayer_queue.title'),
                description: locale.__('musicplayer_queue.empty'),
                user: data.getUser()
            });
        else {
            const nowPlayingText = `${
                instance.getLoopMode() === DiscordMusicPlayerLoopMode.Current
                    ? ` ${locale.__('musicplayer_queue.looping_current')}`
                    : ''
            }: [${queue.track[0].title}](${queue.track[0].url})`;

            if (queue.track.length == 1) {
                let queueString = `1. [${queue.track[0].title}](${queue.track[0].url})`;
                return makeInfoEmbed({
                    title: locale.__('musicplayer_queue.title'),
                    description: `${locale.__('musicplayer_queue.now_playing')}${nowPlayingText}\n
                        There are ${queue.track.length} song in the queue!\n${queueString}`,
                    user: data.getUser()
                });
            } else if (queue.track.length >= 10) {
                const upcomingText = `[${queue.track[1].title}](${queue.track[1].url})`;
                const first10 = queue.track.slice(0, 10);
                let queueString = first10
                    .map((track, index) => `${index + 1}. [${track.title}](${track.url})`)
                    .join('\n');
                return makeInfoEmbed({
                    title: locale.__('musicplayer_queue.title'),
                    description: `${locale.__('musicplayer_queue.now_playing')}${nowPlayingText}
                        ${locale.__('musicplayer_queue.upcoming_song')} ${upcomingText}\n
                        ${locale.__('musicplayer_queue.song_x_in_queue', queue.track.length.toString())}
                        ${queueString}\n${queue.track.length > 10 ? `...${queue.track.length - 10} more songs` : ''}`,
                    user: data.getUser()
                });
            } else {
                const upcomingText = `[${queue.track[1].title}](${queue.track[1].url})`;
                const queueString = queue.track
                    .map((track, index) => `${index + 1}. [${track.title}](${track.url})`)
                    .join('\n');
                return makeInfoEmbed({
                    title: locale.__('musicplayer_queue.title'),
                    description: `${locale.__('musicplayer_queue.now_playing')}${nowPlayingText}
                        ${locale.__('musicplayer_queue.upcoming_song')} ${upcomingText}\n
                        ${locale.__('musicplayer_queue.song_x_in_queue', queue.track.length.toString())}
                        ${queueString}`,
                    user: data.getUser()
                });
            }
        }
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

        const locale = await Locale.getGuildLocale(guild.id);

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if (!instance)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)]
            });

        await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.QUEUE(data, locale, instance)] });

        return;
    }
}
