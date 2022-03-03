import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction, VoiceChannel, MessageActionRow, MessageButton, SelectMenuInteraction, ButtonInteraction } from "discord.js";
import { makeErrorEmbed, makeSuccessEmbed, sendHybridInteractionMessageResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer, { ValidTracks } from "../../providers/DiscordMusicPlayer";
import { joinVoiceChannelProcedure } from "./Join";

const EMBEDS = {
    PLAY_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Play',
            description: `Play a song`,
            fields: [
                {
                    name: 'Arguments',
                    value: '``Search query or Link``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    YOUTUBE_ONLY: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `Only youtube.com link is supported for now`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_LINK: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `Invalid Link`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ADDED_QUEUE: (data: Message | Interaction, track: ValidTracks) => {
        let embed = makeSuccessEmbed({
            title: `Song added to queue!`,
            description: `${track.title}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });

        const highestResolutionThumbnail = track.thumbnails.reduce((prev, current) => (prev.height * prev.width > current.height * current.width) ? prev : current)

        if(highestResolutionThumbnail)
            embed.setImage(highestResolutionThumbnail.url);
            
        return embed;
    },
    ADDED_SONGS_QUEUE: (data: Message | Interaction, track: ValidTracks[]) => {
        let embed = makeSuccessEmbed({
            title: `Songs added to queue!`,
            description: `Added ${track.length} songs to queue`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
        return embed;
    },
    USER_NOT_IN_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You need to be in the voice channel first!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_IN_SAME_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You are not in the same voice channel!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    LOOKUP_ERROR: (data: Message | Interaction, error: Error) => {

        let errorMessage = "";

        if(error.message === "While getting info from url\nPrivate video")
            errorMessage = "This is a private video";
        else
            errorMessage = error.message.replace("While getting info from url\n", "").replace("While getting info from url", "");

        return makeErrorEmbed({
            title: `Error while looking up the song`,
            description: `${errorMessage}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
}
export default class Play extends DiscordModule {

    public id = "Discord_MusicPlayer_Play";
    public commands = ["play", "p"];
    public commandInteractionName = "play";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async GuildButtonInteractionCreate(interaction: ButtonInteraction) {
        const hybridData = new HybridInteractionMessage(interaction);
        const guild = hybridData.getGuild();
        const member = hybridData.getMember();
        const user = hybridData.getUser();

        if (!guild || !member || !user) return;
        if (!this.isJSONValid(interaction.customId)) return;

        let payload = JSON.parse(interaction.customId);

        if (typeof payload.m === 'undefined' || typeof payload.a === 'undefined') return;

        /*
            Discord have 100 char custom id char limit
            So we need to shorten our json.
            MP_P stands for MusicPlayer_Play
            data.v stands for data.videoId
            data.l stands for data.listId
        */

        if (payload.m === 'MP_P' && payload.a === 'arp') {

            if (typeof payload.d === 'undefined') return;

            let data = payload.d.split('$');
            if (data.length !== 3) return;

            payload.d = {
                c: data[0],
                v: data[1],
                l: data[2]
            }

            await interaction.deferReply();

            let voiceChannel = DiscordProvider.client.guilds.cache.get(guild.id)?.channels.cache.get(payload.d.c);
            //let member = DiscordProvider.client.guilds.cache.get(guild.id)?.members.cache.get(interaction.member?.user?.id);

            if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) return;


            if (!member.voice.channel)
                return await sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(hybridData.getRaw())] }, true);

            if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id))
                await joinVoiceChannelProcedure(interaction, null, voiceChannel);

            let instance = DiscordMusicPlayer.getGuildInstance(guild.id);

            if (instance!.voiceChannel.id !== member.voice.channel.id)
                return await sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(hybridData.getRaw())] }, true);

            if (!instance!.isConnected()) {
                await joinVoiceChannelProcedure(interaction, instance!, voiceChannel);
                instance = DiscordMusicPlayer.getGuildInstance(guild.id);
            }

            if (!instance) return;

            let playlist = await DiscordMusicPlayer.getYouTubeSongsInPlayList(`https://www.youtube.com/watch?v=${payload.d.v}&list=${payload.d.l}`);
            const songs = (await playlist.all_videos()).filter((song) => {
                return payload.d.v !== song.id;
            });

            for (let song of songs) {
                instance.addTrackToQueue(song);
            }

            if(hybridData.getSelectMenu().message instanceof Message)
                await (hybridData.getSelectMenu().message as Message).edit({ components: [] });

            return await sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.ADDED_SONGS_QUEUE(hybridData.getRaw(), songs)] }, true);
        }
    }

    async GuildSelectMenuInteractionCreate(interaction: SelectMenuInteraction) {

        const hybridData = new HybridInteractionMessage(interaction);
        const guild = hybridData.getGuild();
        const member = hybridData.getMember();
        const user = hybridData.getUser();

        if (!guild || !member || !user) return;
        if (!this.isJSONValid(interaction.customId)) return;

        let payload = JSON.parse(interaction.customId);

        /*
            Discord have 100 char custom id char limit
            So we need to shorten our json.
            MP_SM stands for MusicPlayer_SearchMenu
            data.r stands for data.requester
            data.v stands for data.voiceChannel
        */
        if (typeof payload.m === 'undefined' || typeof payload.a === 'undefined') return;

        if (payload.m === 'MP_SM' && payload.a === 'play') {

            await interaction.deferReply();

            const voiceChannel = DiscordProvider.client.guilds.cache.get(guild.id)?.channels.cache.get(payload.d.v);
            //let member = DiscordProvider.client.guilds.cache.get(guild.id)?.members.cache.get(user.id);

            if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) return;

            if (!member.voice.channel)
                return await sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(interaction)] }, true);

            if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id))
                await joinVoiceChannelProcedure(interaction, null, voiceChannel);


            let instance = DiscordMusicPlayer.getGuildInstance(guild.id);

            if (instance!.voiceChannel.id !== member.voice.channel.id)
                return await sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(interaction)] }, true);

            if (!instance!.isConnected()) {
                await joinVoiceChannelProcedure(interaction, instance!, voiceChannel);
                instance = DiscordMusicPlayer.getGuildInstance(guild.id);
            }

            if (!instance) return;

            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(DiscordMusicPlayer.parseYouTubeLink(interaction.values[0])).catch((err) => {
                sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.LOOKUP_ERROR(hybridData.getRaw(), err)] }, true);
                return null;
            });
            if (!result) return;

            instance.addTrackToQueue(result);
            return await sendHybridInteractionMessageResponse(hybridData, { embeds: [EMBEDS.ADDED_QUEUE(interaction, result)] }, true);
        }

    }

    async run(data: HybridInteractionMessage, args: any) {

        let query;
        const guild = data.getGuild();
        const channel = data.getChannel();
        const member = data.getMember();

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PLAY_INFO(data.getRaw())] });

            query = args.join(' ');
        }
        else if (data.isSlashCommand()) {
            query = args.getSubcommand();
        }

        if (!query || !guild || !channel || !member) return;

        if (!member.voice.channel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data.getRaw())] });

        const voiceChannel = member.voice.channel;

        if (!DiscordMusicPlayer.isGuildInstanceExists(guild.id)) {
            await joinVoiceChannelProcedure(data.getRaw(), null, voiceChannel);
        }

        let instance = DiscordMusicPlayer.getGuildInstance(guild.id);

        if (instance!.voiceChannel.id !== member.voice.channel.id)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data.getRaw())] }, true);

        if (!instance!.isConnected()) {
            await joinVoiceChannelProcedure(data.getRaw(), instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        }

        if (!instance) return;

        if (DiscordMusicPlayer.isYouTubeLink(query)) {
            let linkData = DiscordMusicPlayer.parseYouTubeLink(query);

            if (linkData.videoId === "" && linkData.list) {
                let playlist = await DiscordMusicPlayer.getYouTubeSongsInPlayList(query);
                const songs = await playlist.all_videos();

                for (let song of songs) {
                    instance.addTrackToQueue(song);
                }
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ADDED_SONGS_QUEUE(data.getRaw(), songs)] }, true);
            }

            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(linkData).catch((err) => {
                sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.LOOKUP_ERROR(data.getRaw(), err)] }, true);
                return null;
            });

            if (!result) return;

            if (data.isMessage() && data.getMessage().embeds.length > 0) {
                data.getMessage().suppressEmbeds(true);
            }

            instance.addTrackToQueue(result);

            if (linkData.list) {
                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setEmoji('✅')
                            .setCustomId(JSON.stringify({
                                m: 'MP_P',
                                a: 'arp', // Add remaining playlist
                                d: `${voiceChannel.id}$${linkData.videoId}$${linkData.list}`
                            }))
                            .setLabel('  Add the remaining songs in the playlist')
                            .setStyle('PRIMARY')
                    )

                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data.getRaw(), result)], components: [row] });
            }
            else
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data.getRaw(), result)] });
        } else {
            let result = await DiscordMusicPlayer.searchYouTubeByQuery(query);

            if (!result) return;
            instance.addTrackToQueue(result[0]);

            if (result.length > 1) {

                // TODO: Find a better logic than this
                // If the first result title is exact match with the query or first title contains half the space of the query, it's probably a sentence
                // then we don't need to show the search results
                // if(result[0].title === query || result[0].title && (Math.ceil((result[0].title.split(" ").length - 1) / 2) === Math.ceil((query.split(" ").length - 1) / 2))) return;

                // The query length is too long to fit in json
                if (query.length > 100 - 51) return;

                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setEmoji('🔎')
                            .setCustomId(JSON.stringify({
                                m: 'MP_S',
                                a: 'search',
                                d: {
                                    q: query
                                }
                            }))
                            .setLabel('  Not this? Search!')
                            .setStyle('PRIMARY')
                    )

                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data.getRaw(), result[0])], components: [row] });
            }

            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data.getRaw(), result[0])] });
        }
    }

    isJSONValid(jsonString: string) {
        try {
            let o = JSON.parse(jsonString);
            if (o && typeof o === "object") {
                return true;
            }
        }
        catch (e) { }
        return false;
    }

}