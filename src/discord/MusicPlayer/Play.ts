import { Message, CommandInteraction, Interaction, VoiceChannel, MessageActionRow, MessageButton, TextChannel } from "discord.js";
import { makeErrorEmbed, makeSuccessEmbed, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
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
        embed.setImage(track.thumbnails[0].url);
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
}


export default class Play {

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'play' && command.toLowerCase() !== 'p') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: Interaction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'play') return;
            await this.process(interaction, interaction.options);
        }
        else if (interaction.isSelectMenu()) {
            if (!interaction.guild || !interaction.guildId) return;
            if (!this.tryParseJSONObject(interaction.customId)) return;

            let payload = JSON.parse(interaction.customId);
            if (!interaction.member?.user?.id) return;

            if (typeof payload.m === 'undefined' || typeof payload.a === 'undefined') return;

            /*
                Discord have 100 char custom id char limit
                So we need to shorten our json.
                MP_SM stands for MusicPlayer_SearchMenu
                data.r stands for data.requester
                data.v stands for data.voiceChannel
            */

            if (payload.m === 'MP_SM' && payload.a === 'play') {

                await interaction.deferReply();

                let voiceChannel = DiscordProvider.client.guilds.cache.get(interaction.guildId)?.channels.cache.get(payload.d.v);
                let member = DiscordProvider.client.guilds.cache.get(interaction.guildId)?.members.cache.get(interaction.member?.user?.id);

                if (!member) return;
                if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) return;


                if (!member.voice.channel)
                    return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(interaction)] }, true);

                if (!DiscordMusicPlayer.isGuildInstanceExists(interaction.guildId)) {
                    await joinVoiceChannelProcedure(interaction, null, voiceChannel);
                }

                let instance = DiscordMusicPlayer.getGuildInstance(interaction.guildId);

                if (instance!.voiceChannel.id !== member.voice.channel.id)
                    return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(interaction)] }, true);

                if (!instance!.isConnected()) {
                    await joinVoiceChannelProcedure(interaction, instance!, voiceChannel);
                    instance = DiscordMusicPlayer.getGuildInstance(interaction.guildId);
                }

                if (!instance) return;

                let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(DiscordMusicPlayer.parseYouTubeLink(interaction.values[0]));
                if (!result) return;

                instance.addTrackToQueue(result);
                //interaction.editReply({ embeds: [EMBEDS.ADDED_QUEUE(interaction, result)] });
                return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.ADDED_QUEUE(interaction, result)] }, true);
            }
        }
        else if (interaction.isButton()) {

            if (!interaction.guild || !interaction.guildId) return;
            if (!this.tryParseJSONObject(interaction.customId)) return;

            let payload = JSON.parse(interaction.customId);
            if (!interaction.member?.user?.id) return;

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
                if(data.length !== 3) return;

                payload.d = {
                    c: data[0],
                    v: data[1],
                    l: data[2]
                }

                await interaction.deferReply();
                
                let voiceChannel = DiscordProvider.client.guilds.cache.get(interaction.guildId)?.channels.cache.get(payload.d.c);
                let member = DiscordProvider.client.guilds.cache.get(interaction.guildId)?.members.cache.get(interaction.member?.user?.id);

                if (!member) return;
                if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) return;


                if (!member.voice.channel)
                    return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(interaction)] }, true);

                if (!DiscordMusicPlayer.isGuildInstanceExists(interaction.guildId)) {
                    await joinVoiceChannelProcedure(interaction, null, voiceChannel);
                }

                let instance = DiscordMusicPlayer.getGuildInstance(interaction.guildId);

                if (instance!.voiceChannel.id !== member.voice.channel.id)
                    return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(interaction)] }, true);

                if (!instance!.isConnected()) {
                    await joinVoiceChannelProcedure(interaction, instance!, voiceChannel);
                    instance = DiscordMusicPlayer.getGuildInstance(interaction.guildId);
                }

                if (!instance) return;

                let playlist = await DiscordMusicPlayer.getYouTubeSongsInPlayList(`https://www.youtube.com/watch?v=${payload.d.v}&list=${payload.d.l}`);
                const songs = (await playlist.all_videos()).filter((song) => {
                    return payload.d.v !== song.id;
                });

                for(let song of songs) {
                    instance.addTrackToQueue(song);
                }

                await (interaction.message as Message).edit({ components: [] });
                return await sendMessageOrInteractionResponse(interaction, { embeds: [EMBEDS.ADDED_SONGS_QUEUE(interaction, songs)] }, true);
            }
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        if (!data.member) return;
        if (!data.guild) return;
        if (!data.guildId) return;

        let query;

        if (isMessage) {
            if (data === null || !data.guildId || data.member === null || data.guild === null) return;

            if (args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PLAY_INFO(data)] });
            }
            query = args.join(' ');

        }
        else if (isSlashCommand) {
            query = args.getSubcommand();
        }

        if (!query) return;
        if (!(data.channel instanceof TextChannel)) return;

        if (!data.member.voice.channel)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data)] });

        let voiceChannel = data.member.voice.channel;

        if (!DiscordMusicPlayer.isGuildInstanceExists(data.guildId)) {
            await joinVoiceChannelProcedure(data, null, voiceChannel);
        }

        let instance = DiscordMusicPlayer.getGuildInstance(data.guildId);

        if (instance!.voiceChannel.id !== data.member.voice.channel.id)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data)] }, true);

        if (!instance!.isConnected()) {
            await joinVoiceChannelProcedure(data, instance!, voiceChannel);
            instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        }

        if (!instance) return;

        if (DiscordMusicPlayer.isYouTubeLink(query)) {
            let linkData = DiscordMusicPlayer.parseYouTubeLink(query);

            if(linkData.videoId === "" && linkData.list) {
                let playlist = await DiscordMusicPlayer.getYouTubeSongsInPlayList(query);
                const songs = await playlist.all_videos();

                for(let song of songs) {
                    instance.addTrackToQueue(song);
                }
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_SONGS_QUEUE(data, songs)] }, true);
            }

            let result = await DiscordMusicPlayer.searchYouTubeByYouTubeLink(linkData);

            if (!result) return;

            if (isMessage && (data as Message).embeds.length > 0) {
                (data as Message).suppressEmbeds(true);
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

                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data, result)], components: [row] });
            }
            else
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data, result)] });
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

                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data, result[0])], components: [row] });
            }

            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ADDED_QUEUE(data, result[0])] });
        }

        return;
    }

    tryParseJSONObject(jsonString: string) {
        try {
            let o = JSON.parse(jsonString);
            if (o && typeof o === "object") {
                return true;
                //return o;
            }
        }
        catch (e) { }

        return false;
    }


}