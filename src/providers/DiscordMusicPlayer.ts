import playdl, { YouTubeVideo, InfoData } from "play-dl";
import { Message, VoiceChannel, Snowflake, TextChannel, StageChannel, Guild } from "discord.js";
import { AudioPlayer, VoiceConnection, createAudioPlayer, joinVoiceChannel, createAudioResource, StreamType, VoiceConnectionStatus, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionDestroyedState, VoiceConnectionState, DiscordGatewayAdapterCreator, AudioResource, AudioPlayerError } from "@discordjs/voice";
import { EventEmitter } from "stream";

import DiscordProvider from "./Discord";
import Environment from "./Environment";

export type ValidTracks = YouTubeVideo;

if (Environment.get().YOUTUBE_COOKIE_BASE64) {
    playdl.setToken({
        youtube: {
            cookie: Buffer.from(Environment.get().YOUTUBE_COOKIE_BASE64, 'base64').toString()
        }
    })
}
export class Queue {
    public track: (ValidTracks)[] = [];
}

export class YouTubeLink {
    public videoId: string;
    public list?: string;

    constructor(videoId: string, list: string) {
        this.videoId = videoId;
        this.list = list;
    }
}

export class PlayerPlayingEvent {
    public instance: DiscordMusicPlayerInstance;

    constructor(instance: DiscordMusicPlayerInstance) {
        this.instance = instance;
    }
}

export class PlayerErrorEvent {
    public instance: DiscordMusicPlayerInstance;
    public error: Error;

    constructor(instance: DiscordMusicPlayerInstance, error: Error) {
        this.instance = instance;
        this.error = error;
    }
}

export class VoiceDisconnectedEvent {
    public instance: DiscordMusicPlayerInstance;

    constructor(instance: DiscordMusicPlayerInstance) {
        this.instance = instance;
    }
}
export class DiscordMusicPlayerInstance {
    public queue: Queue;
    public player: AudioPlayer;
    public textChannel?: TextChannel;
    public voiceChannel: (VoiceChannel | StageChannel);
    public voiceConnection?: VoiceConnection;

    public readonly events: EventEmitter;

    constructor({ voiceChannel }: { voiceChannel: (VoiceChannel | StageChannel) }) {
        this.queue = new Queue();
        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
                maxMissedFrames: 1000
            }
        });
        this.voiceChannel = voiceChannel;
        this.events = new EventEmitter();

        this.player.on(AudioPlayerStatus.Idle, async (oldStage, newStage) => {
            //The player stopped
            if (newStage.status === AudioPlayerStatus.Idle && oldStage.status !== AudioPlayerStatus.Idle) {
                if (this.queue.track.length !== 0) {
                    this.queue.track.shift();
                    if (this.queue.track.length > 0) {
                        this.playTrack(this.queue.track[0]);
                    }
                }
            }
        });

        this.player.on(AudioPlayerStatus.Playing, (oldState: any, newState: any) => {
            this.events.emit('playing', new PlayerPlayingEvent(this));
        });

        this.player.on('error', (error: Error) => {
            this.events.emit('error', new PlayerErrorEvent(this, error));
        });
    }

    public isReady() {
        if (!this.voiceConnection) return false;
        return this.voiceConnection.state.status === VoiceConnectionStatus.Ready;
    }

    public isConnected() {
        if (!this.voiceConnection) return false;

        if (this.voiceConnection.state.status === VoiceConnectionStatus.Destroyed) return false;
        if (this.voiceConnection.state.status === VoiceConnectionStatus.Disconnected) return false;

        return true;
    }

    public joinVoiceChannel(voiceChannel: (VoiceChannel | StageChannel), textChannel?: TextChannel) {
        const permissions = voiceChannel.permissionsFor(DiscordProvider.client.user!);
        if (!permissions)
            throw new Error("No permissions");

        if (!voiceChannel.joinable || !permissions.has("CONNECT"))
            throw new Error("No permissions");

        if (textChannel)
            this.textChannel = textChannel;

        this.voiceConnection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.voiceChannel.guild.id,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator
        });

        this.voiceConnection.on(VoiceConnectionStatus.Ready, (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
            let currentVC = DiscordProvider.client.guilds.cache.get(voiceChannel.guild.id)?.me?.voice.channel;
            if (currentVC && currentVC.id !== this.voiceChannel.id) {
                this.voiceChannel = currentVC;
            }
        });

        this.voiceConnection.on(VoiceConnectionStatus.Disconnected, (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
            setTimeout(() => {
                if (!DiscordProvider.client.guilds.cache.get(voiceChannel.guildId!)!.me!.voice.channelId) {
                    this.events.emit('disconnect', new VoiceDisconnectedEvent(this));
                }
            }, 1000);
        });
    }

    public async leaveVoiceChannel() {

        if (this.player)
            this.player.pause();

        if (DiscordProvider.client.guilds.cache.get(this.voiceChannel.guild.id)?.me?.voice) {
            await DiscordProvider.client.guilds.cache.get(this.voiceChannel.guild.id)?.me?.voice.disconnect();
        }

    }

    public addTrackToQueue(track: (ValidTracks)) {

        if (this.queue.track.length === 0) {
            this.queue.track.push(track);
            this.playTrack(this.queue.track[0]);
            return;
        }

        this.queue.track.push(track);
    }

    public async playTrack(track: ValidTracks) {

        if (!this.voiceConnection) throw new Error("No voice connection");

        const stream = await playdl.stream(track.url);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type
        });

        this.player.play(resource)
        this.voiceConnection.subscribe(this.player)
    }

    public async skipTrack() {
        if (!this.voiceConnection) throw new Error("No voice connection");

        if (this.queue.track.length > 1) {
            this.queue.track.shift();
            this.playTrack(this.queue.track[0]);
        }
        else {
            this.queue.track.shift();
            this.player.stop();
        }
    }

    public async destroy() {
        await this.leaveVoiceChannel();

        if (this.voiceConnection) {
            this.voiceConnection.removeAllListeners();
            if (this.voiceConnection.state.status !== 'destroyed')
                this.voiceConnection.destroy();
        }

        if (this.player) {
            this.player.removeAllListeners();
            this.player.stop(true);
        }

        this.queue.track = [];
        this.textChannel = undefined;
        this.voiceConnection = undefined;
    }

    public async _fake_error_on_player() {
        this.player.emit('error', new AudioPlayerError(new Error("fake error"), null!));
    }

}

class DiscordMusicPlayer {

    public GuildQueue = new Map();

    public getGuildInstance(guildId: Snowflake): (DiscordMusicPlayerInstance | null) {
        if (!this.isGuildInstanceExists(guildId)) return null;
        return this.GuildQueue.get(guildId);
    }

    public isGuildInstanceExists(guildId: Snowflake) {
        return this.GuildQueue.has(guildId);
    }

    public createGuildInstance(guildId: Snowflake, voiceChannel: (VoiceChannel | StageChannel)) {
        this.GuildQueue.set(guildId, new DiscordMusicPlayerInstance({ voiceChannel }));
    }

    public async destoryGuildInstance(guild: (Guild | Snowflake)) {

        let guildId: Snowflake = guild instanceof Guild ? guild.id : guild;

        if (this.isGuildInstanceExists(guildId)) {
            await this.GuildQueue.get(guildId).destroy();
            this.GuildQueue.delete(guildId);
        }
    }

    public async searchYouTubeByQuery(query: string) {
        const searched: YouTubeVideo[] = await playdl.search(query, { source: { youtube: "video" } });
        if (searched.length == 0) return null;
        return searched;
    }

    public async searchYouTubeByYouTubeLink(youtubeLink: YouTubeLink) {

        // Search the url
        const searched: YouTubeVideo[] = await playdl.search("https://www.youtube.com/watch?v=" + youtubeLink.videoId, { source: { youtube: "video" } });
        for (let video of searched) {
            if (video.id === youtubeLink.videoId)
                return video;
        }

        // Serch the video Id
        const searched2: YouTubeVideo[] = await playdl.search(youtubeLink.videoId, { source: { youtube: "video" } });
        for (let video of searched2) {
            if (video.id === youtubeLink.videoId)
                return video;
        }

        // Last resort, search the title
        const videoInfo = await playdl.video_basic_info("https://www.youtube.com/watch?v=" + youtubeLink.videoId);
        if (videoInfo?.video_details?.title) {
            const searched: YouTubeVideo[] = await playdl.search(videoInfo.video_details.title, { source: { youtube: "video" } });
            for (let video of searched) {
                if (video.id === youtubeLink.videoId)
                    return video;
            }
        }

        let yt_info = await playdl.video_info("https://www.youtube.com/watch?v=" + youtubeLink.videoId);
        if(yt_info) {
            return new YouTubeVideo({
                id: yt_info.video_details.id,
                url: yt_info.video_details.url,
                type: yt_info.video_details.type,
                title: yt_info.video_details.title,
                description: yt_info.video_details.description,
                durationRaw: yt_info.video_details.durationRaw,
                durationInSec: yt_info.video_details.durationInSec,
                uploadedAt: yt_info.video_details.uploadedAt,
                upcoming:  yt_info.video_details.upcoming,
                views: yt_info.video_details.views,
                thumbnails: yt_info.video_details.thumbnails,
                channel: yt_info.video_details.channel,
                likes: yt_info.video_details.likes,
                live: yt_info.video_details.live,
                private: yt_info.video_details.private,
                tags: yt_info.video_details.tags,
                discretionAdvised: yt_info.video_details.discretionAdvised,
                music: yt_info.video_details.music
            });
        }


        return null;
    }

    public async getYouTubeSongsInPlayList(youtubeLink: string) {
        return await playdl.playlist_info(youtubeLink, {
            incomplete: true
        });
    }

    public isYouTubeLink(link: string): boolean {
        try {
            this.parseYouTubeLink(link);
            return true;
        } catch (err) {
            return false;
        }
    }

    public parseYouTubeLink(query: string): YouTubeLink {
        if (query.startsWith('https://www.youtube.com/watch?v=') || query.startsWith('http://www.youtube.com/watch?v=')) {
            let data = this.parseURLQuery(query);
            if (!data.v)
                throw new Error('YouTube link is invalid');
            return {
                videoId: data.v,
                list: (data.list ? (data.list !== "RDMM" ? data.list : undefined) : undefined)
            }
        }
        else if (query.startsWith('https://youtu.be/') || query.startsWith('http://youtu.be/')) {
            //Get youtube video id after the url
            let videoId = query.split('/')[3];

            if (!videoId) throw new Error('YouTube link is invalid');
            if (query.split('/')[4]) throw new Error('YouTube link is invalid');

            return {
                videoId: videoId
            }
        }
        else if (query.startsWith('https://www.youtube.com/playlist?list=') || query.startsWith('http://www.youtube.com/playlist?list=')) {
            let listId = query.split('?list=')[1];
            return {
                videoId: "",
                list: listId
            }
        }
        else {
            throw new Error('YouTube link is invalid');
        }
    }

    private parseURLQuery(query: string) {
        let queryObject: any = {};
        if (query.indexOf('?') >= 0) {
            let queryString = query.split('?')[1];
            let queryArray = queryString.split('&');
            for (let i = 0; i < queryArray.length; i++) {
                let queryPair = queryArray[i].split('=');
                queryObject[queryPair[0]] = queryPair[1];
            }
        }
        return queryObject;
    }

}

const DiscordMusicPlayer_Instance = new DiscordMusicPlayer();
export default DiscordMusicPlayer_Instance;