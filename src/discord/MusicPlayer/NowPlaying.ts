import { Message, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { I18n } from 'i18n';
import { SpotifyTrack, YouTubeVideo } from 'play-dl';

import DiscordProvider from '../../providers/Discord';
import DiscordMusicPlayer, { TrackUtils, ValidTracks } from '../../providers/DiscordMusicPlayer';
import Locale from '../../services/Locale';

import { makeErrorEmbed, makeInfoEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';
import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { AudioInformation } from '../../../NekoMelody/src/providers/base';

const EMBEDS = {
    NOW_PLAYING: async (data: HybridInteractionMessage, locale: I18n, track: AudioInformation) => {
        const title = track.metadata.title;
        const thumbnail = track.metadata.thumbnail;

        const embed = makeInfoEmbed({
            title: locale.__('musicplayer.now_playing'),
            icon: '🎵 ',
            description: title,
            user: DiscordProvider.client.user
        });

        if (thumbnail) embed.setImage(thumbnail);

        return embed;
    },
    NO_MUSIC_PLAYING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.no_music_playing'),
            user: data.getUser()
        });
    }
};

export default class NowPlaying extends DiscordModule {
    public id = 'Discord_MusicPlayer_NowPlaying';
    public commands = ['nowplaying', 'np'];
    public commandInteractionName = 'nowplaying';

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
        const current = instance?.nekoPlayer.getCurrentAudioInformation();

        if (!instance || !current)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)]
            });

        const row = new ActionRowBuilder<ButtonBuilder>();

        // if (instance.queue.track[0] instanceof SpotifyTrack)
        //     row.addComponents([
        //         new ButtonBuilder()
        //             .setEmoji('🟢')
        //             .setLabel(' Open in Spotify')
        //             .setURL(encodeURI(`https://open.spotify.com/track/${instance.queue.track[0].id}`))
        //             .setStyle(ButtonStyle.Link)
        //     ]);

        row.addComponents([
            new ButtonBuilder()
                .setEmoji('🔴')
                .setLabel(' Open in YouTube')
                .setURL(current.metadata.url)
                .setStyle(ButtonStyle.Link)
        ]);

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [await EMBEDS.NOW_PLAYING(data, locale, current)],
            components: [row]
        });
    }
}
