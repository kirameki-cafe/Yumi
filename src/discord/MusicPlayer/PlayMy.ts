import { I18n } from "i18n";
import { Message, CommandInteraction, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import DiscordMusicPlayer, { TrackUtils, ValidTracks } from "../../providers/DiscordMusicPlayer";
import Locale from "../../services/Locale";

import { makeSuccessEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";
import { joinVoiceChannelProcedure } from "./Join";

const EMBEDS = {
    NOT_DETECTED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('musicplayer_playmy.not_detected'),
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
    },
    ADDED_QUEUE: async (data: HybridInteractionMessage, locale: I18n, track: ValidTracks) => {

        const title = TrackUtils.getTitle(track);
        const thumbnails = await TrackUtils.getThumbnails(track);

        let embed = makeSuccessEmbed({
            title: locale.__('musicplayer_play.queue_added_song'),
            description: title,
            user: data.getUser()
        });

        if (TrackUtils.getHighestResolutionThumbnail(thumbnails))
            embed.setImage(TrackUtils.getHighestResolutionThumbnail(thumbnails).url);

        return embed;
    }
}

export default class PlayMy extends DiscordModule {
    
    public id = "Discord_MusicPlayer_PlayMy";
    public commands = ["playmy"];
    public commandInteractionName = "playmy";

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

        if (!member.voice.channel)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data, locale)]
            });

        const voiceChannel = member.voice.channel;

        if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id)) {
            await joinVoiceChannelProcedure(data, null, voiceChannel);
        }

        let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if (!instance) return;

        if (instance!.voiceChannel.id !== member.voice.channel.id)
            return await sendHybridInteractionMessageResponse(
                data,
                { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data, locale)] },
                true
            );

        if (!instance!.isConnected()) {
            await joinVoiceChannelProcedure(data, instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        }

        if(!instance) return;
        if(!member.presence) return;
        if(!member.presence.activities) return;

        let query;
        let found = false;
        for (const activity of member.presence.activities) {
            if(activity.type === ActivityType.Listening) {
                if(!activity.details) continue;
                found = true;

                if(activity.name == "Spotify")
                    query = `${activity.state} - ${activity.details}`
                else
                    query = `${activity.state} - ${activity.details}` // TODO: Find better query formula
            
                const result = await DiscordMusicPlayer.searchYouTubeByQuery(query);
                if (!result) continue;
                instance.addTrackToQueue(result[0]);

                let row;
                if (result.length > 1) {
                    // TODO: Find a better logic than this
                    // If the first result title is exact match with the query or first title contains half the space of the query, it's probably a sentence
                    // then we don't need to show the search results
                    // if(result[0].title === query || result[0].title && (Math.ceil((result[0].title.split(" ").length - 1) / 2) === Math.ceil((query.split(" ").length - 1) / 2))) return;
    
                    // The query length is too long to fit in json
                    if (query.length > 100 - 51) return;
    
                    row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setEmoji('🔎')
                            .setCustomId(
                                JSON.stringify({
                                    m: 'MP_S',
                                    a: 'search',
                                    d: {
                                        q: query
                                    }
                                })
                            )
                            .setLabel('  Not this? Search!')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                if(!row)
                    await sendHybridInteractionMessageResponse(data, {
                        embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result[0])]
                    });
                else
                    await sendHybridInteractionMessageResponse(data, {
                        embeds: [await EMBEDS.ADDED_QUEUE(data, locale, result[0])],
                        components: [row]
                    });
            }
        }

        if(!found)
            await sendHybridInteractionMessageResponse(data, { embeds:[EMBEDS.NOT_DETECTED(data, locale)] });

        return;
    }
}