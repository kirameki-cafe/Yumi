import { Message, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { I18n } from "i18n";
import { SpotifyTrack, YouTubeVideo } from "play-dl";

import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer, { TrackUtils, ValidTracks } from "../../providers/DiscordMusicPlayer";
import Locale from "../../services/Locale";

import { makeErrorEmbed, makeInfoEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

const EMBEDS = {
    NOW_PLAYING: async (data: HybridInteractionMessage, locale: I18n, track: ValidTracks) => {

        const title = TrackUtils.getTitle(track);
        const thumbnails = await TrackUtils.getThumbnails(track);

        const embed = makeInfoEmbed({
            title: locale.__('musicplayer.now_playing'),
            icon: '🎵 ',
            description: title,
            user: DiscordProvider.client.user
        });

        if (TrackUtils.getHighestResolutionThumbnail(thumbnails))
            embed.setImage(TrackUtils.getHighestResolutionThumbnail(thumbnails).url);
        
        return embed;
    },
    NO_MUSIC_PLAYING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer.no_music_playing'),
            user: data.getUser()
        });
    }
}

export default class NowPlaying extends DiscordModule {

    public id = "Discord_MusicPlayer_NowPlaying";
    public commands = ["nowplaying", "np"];
    public commandInteractionName = "nowplaying";
    
    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();
        if(!guild) return;
        
        const locale = await Locale.getGuildLocale(guild.id);
        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if(!instance || !instance.queue.track[0]) return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data, locale)] });

        const row = new ActionRowBuilder<ButtonBuilder>();

        if(instance.queue.track[0] instanceof SpotifyTrack)
            row.addComponents(
                new ButtonBuilder()
                    .setEmoji('🟢')
                    .setLabel(' Open on Spotify')
                    .setURL(encodeURI(`https://open.spotify.com/track/${instance.queue.track[0].id}`))
                    .setStyle(ButtonStyle.Link),
            )
        if(instance.queue.track[0] instanceof YouTubeVideo || instance.queue.track[0] instanceof SpotifyTrack) {
                const actualPlaybackURL = instance.getActualPlaybackURL();
                if(instance.queue.track[0] instanceof SpotifyTrack && !actualPlaybackURL) return;
                row.addComponents(
                    new ButtonBuilder()
                        .setEmoji('🔴')
                        .setLabel(' Open on YouTube')
                        .setURL(instance.queue.track[0] instanceof YouTubeVideo ? encodeURI(`https://www.youtube.com/watch?v=${instance.queue.track[0].id}`) : encodeURI(instance.getActualPlaybackURL()!))
                        .setStyle(ButtonStyle.Link),
                )
            }
        return await sendHybridInteractionMessageResponse(data, { embeds: [await EMBEDS.NOW_PLAYING(data, locale, instance.queue.track[0])], components: [row] });
    }
}