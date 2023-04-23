import {
    VoiceChannel,
    Snowflake,
    StageChannel,
    Guild,
    PermissionsBitField,
    BaseGuildVoiceChannel,
    BaseGuildTextChannel
} from 'discord.js';
import {
    AudioPlayer,
    VoiceConnection,
    createAudioPlayer,
    joinVoiceChannel,
    createAudioResource,
    VoiceConnectionStatus,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionState,
    AudioPlayerError,
    DiscordGatewayAdapterCreator
} from '@discordjs/voice';
import playdl, { Spotify, SpotifyPlaylist, SpotifyTrack, YouTubeVideo } from 'play-dl';
import { EventEmitter } from 'stream';

import DiscordProvider from './Discord';
import Environment from './Environment';
import Logger from '../libs/Logger';

const LOGGING_TAG = '[DiscordMusicPlayer]';

export type ValidTracks = YouTubeVideo | SpotifyTrack;
declare class YouTubeThumbnail {
    url: string;
    width: number;
    height: number;
    constructor(data: any);
    toJSON(): {
        url: string;
        width: number;
        height: number;
    };
}

interface SpotifyThumbnail {
    height: number;
    width: number;
    url: string;
}

interface TokenOptions {
    spotify?: {
        client_id: string;
        client_secret: string;
        refresh_token: string;
        market: string;
    };
    soundcloud?: {
        client_id: string;
    };
    youtube?: {
        cookie: string;
    };
    useragent?: string[];
}

let tokenObject: TokenOptions = {};

if (Environment.get().YOUTUBE_COOKIE_BASE64) {
    Logger.debug(LOGGING_TAG, 'Setting YouTube cookie');
    tokenObject.youtube = {
        cookie: Buffer.from(Environment.get().YOUTUBE_COOKIE_BASE64, 'base64').toString()
    };
}

if (
    Environment.get().SPOTIFY_CLIENT_ID &&
    Environment.get().SPOTIFY_CLIENT_SECRET &&
    Environment.get().SPOTIFY_REFRESH_TOKEN &&
    Environment.get().SPOTIFY_CLIENT_MARKET
) {
    Logger.debug(LOGGING_TAG, 'Setting Spotify token');
    tokenObject.spotify = {
        client_id: Environment.get().SPOTIFY_CLIENT_ID,
        client_secret: Environment.get().SPOTIFY_CLIENT_SECRET,
        refresh_token: Environment.get().SPOTIFY_REFRESH_TOKEN,
        market: Environment.get().SPOTIFY_CLIENT_MARKET
    };
}

playdl.setToken(tokenObject);

export class TrackUtils {
    public static getTitle(track: ValidTracks) {
        if (track instanceof YouTubeVideo) {
            return track.title;
        } else if (track instanceof SpotifyTrack) {
            let artistNames = '';
            for (let artist of track.artists) artistNames += artist.name + ' ';

            return `${artistNames} - ${track.name}`;
        } else {
            throw new Error('Invalid track type');
        }
    }
    public static async getThumbnails(track: ValidTracks) {
        if (track instanceof YouTubeVideo) {
            return track.thumbnails;
        } else if (track instanceof SpotifyTrack) {
            if (track.thumbnail) return [track.thumbnail];
            else {
                // Try to find the thumbnail again
                const result = await DiscordMusicPlayer_Instance.searchSpotifyBySpotifyLink(track);
                if (!result) return null;
                if (result.thumbnail) return [result.thumbnail];
                return null;
            }
        } else {
            throw new Error('Invalid track type');
        }
    }
    public static getHighestResolutionThumbnail(thumbnails: YouTubeThumbnail[] | SpotifyThumbnail[] | null) {
        if (!thumbnails) return null;

        return (thumbnails as any[]).reduce((prev: any, current: any) =>
            prev.height * prev.width > current.height * current.width ? prev : current
        );
    }
}

export class Queue {
    public track: ValidTracks[] = [];
}

export class YouTubeLink {
    public videoId: string;
    public list?: string;

    constructor(videoId: string, list: string) {
        this.videoId = videoId;
        this.list = list;
    }
}

export class SpotifyLink {
    public id: string;
    public type: 'track' | 'playlist' | 'album';
    public url: string;

    constructor(id: string, type: 'track' | 'playlist' | 'album', url: string) {
        this.id = id;
        this.type = type;
        this.url = url;
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

export enum DiscordMusicPlayerLoopMode {
    None = 'none',
    Current = 'current'
}

export class DiscordMusicPlayerInstance {
    public queue: Queue;
    public player: AudioPlayer;
    public textChannel?: BaseGuildTextChannel | BaseGuildVoiceChannel;
    public voiceChannel: VoiceChannel | StageChannel;
    public voiceConnection?: VoiceConnection;
    public previousTrack?: ValidTracks;

    public paused: boolean = false;
    public loopMode: DiscordMusicPlayerLoopMode = DiscordMusicPlayerLoopMode.None;

    public actualPlaybackURL?: string;

    public readonly events: EventEmitter;

    constructor({ voiceChannel }: { voiceChannel: VoiceChannel | StageChannel }) {
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
                // Loop mode is set to current song
                if (this.loopMode === DiscordMusicPlayerLoopMode.Current) {
                    if (this.queue.track.length !== 0) {
                        this.previousTrack = this.queue.track[0];
                        this.playTrack(this.queue.track[0]);
                    }
                    return;
                }

                // There are more songs in the queue, remove finished song and play the next one
                if (this.queue.track.length !== 0) {
                    let previousTrack = this.queue.track.shift();
                    if (previousTrack) this.previousTrack = previousTrack;

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

    public joinVoiceChannel(
        voiceChannel: VoiceChannel | StageChannel,
        textChannel?: BaseGuildTextChannel | BaseGuildVoiceChannel
    ) {
        const permissions = voiceChannel.permissionsFor(DiscordProvider.client.user!);

        if (!permissions || !voiceChannel.joinable || !permissions.has(PermissionsBitField.Flags.Connect))
            throw new Error('No permissions');

        if (textChannel) this.textChannel = textChannel;

        this.voiceConnection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.voiceChannel.guild.id,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
        });

        this.voiceConnection.on(
            VoiceConnectionStatus.Ready,
            async (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
                let guild = DiscordProvider.client.guilds.cache.get(voiceChannel.guild.id);
                if (guild) {
                    let currentVC = guild?.members.me?.voice.channel;
                    if (currentVC && currentVC.id !== this.voiceChannel.id) {
                        this.voiceChannel = currentVC;
                    }
                }
            }
        );

        this.voiceConnection.on(
            VoiceConnectionStatus.Disconnected,
            (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
                setTimeout(async () => {
                    let guild = DiscordProvider.client.guilds.cache.get(voiceChannel.guildId);
                    if (guild) {
                        if (!guild?.members.me?.voice.channelId) {
                            this.events.emit('disconnect', new VoiceDisconnectedEvent(this));
                        }
                    }
                }, 2000);
            }
        );
    }

    public async leaveVoiceChannel() {
        if (this.player) this.player.pause();

        const guild = DiscordProvider.client.guilds.cache.get(this.voiceChannel.guild.id);
        if (!guild) return;

        if (guild.members.me?.voice) this.voiceConnection?.disconnect();
    }

    public async pausePlayer() {
        if (this.paused || !this.player) return;
        if (!this.player.pause(true)) throw new Error('Unable to pause player');
        this.paused = true;
    }

    public async resumePlayer() {
        if (!this.paused || !this.player) return;
        if (!this.player.unpause()) throw new Error('Unable to resume player');
        this.paused = false;
    }

    public addTrackToQueue(track: ValidTracks) {
        if (this.queue.track.length === 0) {
            this.queue.track.push(track);
            this.playTrack(this.queue.track[0]);
            return;
        }

        this.queue.track.push(track);
    }

    public async playTrack(track: ValidTracks) {
        if (!this.voiceConnection) throw new Error('No voice connection');

        try {
            let resource;
            if (track instanceof YouTubeVideo) {
                const stream = await playdl.stream(track.url);

                Logger.verbose(
                    LOGGING_TAG,
                    `New stream created, type: ${stream.type}, url: ${track.url}, Guild: ${this.voiceChannel.guild.id}, VoiceChannel: ${this.voiceChannel.id}`
                );

                resource = createAudioResource(stream.stream, {
                    inputType: stream.type
                });
                this.actualPlaybackURL = track.url;
            } else {
                const search = await DiscordMusicPlayer_Instance.searchYouTubeBySpotifyLink(track);
                if (!search) throw new Error('Unable to find Spotify track on YouTube');

                const stream = await playdl.stream(search.url);

                Logger.verbose(
                    LOGGING_TAG,
                    `New stream created, type: ${stream.type}, url: ${track.url}, Guild: ${this.voiceChannel.guild.id}, VoiceChannel: ${this.voiceChannel.id}`
                );

                resource = createAudioResource(stream.stream, {
                    inputType: stream.type
                });
                this.actualPlaybackURL = search.url;
            }

            this.player.play(resource);
            this.voiceConnection.subscribe(this.player);
        } catch (error: any) {
            this.events.emit('error', new PlayerErrorEvent(this, error));
            this.skipTrack();
        }
    }

    public async skipTrack() {
        if (!this.voiceConnection) throw new Error('No voice connection');

        if (this.queue.track.length > 1) {
            this.previousTrack = this.queue.track[0];
            this.queue.track.shift();
            this.playTrack(this.queue.track[0]);
        } else {
            this.previousTrack = this.queue.track[0];
            this.queue.track.shift();
            this.player.stop();
        }
    }

    public clearQueue() {
        if (!this.voiceConnection) throw new Error('No voice connection');

        if (!this.queue.track || this.queue.track.length === 0) return;
        this.queue.track = [this.queue.track[0]];
    }

    public shuffleQueue() {
        if (!this.voiceConnection) throw new Error('No voice connection');

        const shuffleFixedFirst = (queue: ValidTracks[]) => {
            if (queue.length <= 2) return queue;

            const fixedFirst = queue.shift();
            if (!fixedFirst) return queue;

            queue.sort(() => Math.random() - 0.5);
            queue.unshift(fixedFirst);
            return queue;
        };

        if (!this.queue.track || this.queue.track.length === 0) return;
        this.queue.track = shuffleFixedFirst(this.queue.track);
    }

    public setLoopMode(mode: DiscordMusicPlayerLoopMode) {
        this.loopMode = mode;
    }

    public getLoopMode() {
        return this.loopMode;
    }

    public getPreviousTrack(): ValidTracks | undefined {
        return this.previousTrack;
    }

    public getActualPlaybackURL() {
        return this.actualPlaybackURL;
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

    public isPaused() {
        return this.paused;
    }

    public async destroy() {
        await this.leaveVoiceChannel();

        if (this.voiceConnection) {
            this.voiceConnection.removeAllListeners();
            if (this.voiceConnection.state.status !== 'destroyed') this.voiceConnection.destroy();
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
        const stream = 'https://fakestream:42069/fake/stream/fake/audio/fake.mp3';
        const resource = createAudioResource(stream);
        this.player.play(resource);
        this.player.emit('error', new AudioPlayerError(new Error('Music player was manually crashed'), null!));
    }
}

class DiscordMusicPlayer {
    public GuildQueue = new Map();

    public getGuildInstance(guildId: Snowflake): DiscordMusicPlayerInstance | null {
        if (!this.isGuildInstanceExists(guildId)) return null;
        return this.GuildQueue.get(guildId);
    }

    public isGuildInstanceExists(guildId: Snowflake) {
        return this.GuildQueue.has(guildId);
    }

    public createGuildInstance(guildId: Snowflake, voiceChannel: VoiceChannel | StageChannel) {
        this.GuildQueue.set(guildId, new DiscordMusicPlayerInstance({ voiceChannel }));
    }

    public async destoryGuildInstance(guild: Guild | Snowflake) {
        let guildId: Snowflake = guild instanceof Guild ? guild.id : guild;

        if (this.isGuildInstanceExists(guildId)) {
            await this.GuildQueue.get(guildId).destroy();
            this.GuildQueue.delete(guildId);
        }
    }

    public async searchYouTubeByQuery(query: string) {
        const searched: YouTubeVideo[] = await playdl.search(query, {
            source: { youtube: 'video' }
        });

        Logger.verbose(
            LOGGING_TAG,
            `Search YouTube by query: ${query}, Total result: ${searched.length}, ${JSON.stringify(searched)}`
        );

        if (searched.length == 0) return null;
        return searched;
    }

    public async searchYouTubeBySpotifyLink(spotifyLink: SpotifyLink) {
        const track = await this.searchSpotifyBySpotifyLink(spotifyLink);
        if (!track) return;

        let artistNames = '';
        for (let artist of track.artists) artistNames += artist.name + ' ';

        const ytSearchResult = await this.searchYouTubeByQuery(`${artistNames} ${track.name}`);
        if (!ytSearchResult) return null;

        return ytSearchResult[0];
    }

    public async searchSpotifyBySpotifyLink(spotifyLink: SpotifyLink) {
        if (playdl.is_expired()) {
            Logger.debug(LOGGING_TAG, 'Spotify token expired, refreshing...');
            await playdl.refreshToken();
        }

        if (spotifyLink.type != 'track') return;

        // Fetch data from spotify
        const searched: Spotify = await playdl
            .spotify('https://open.spotify.com/track/' + spotifyLink.id)
            .catch((err) => {
                Logger.error(err.message);
                throw new Error('Error while searching on Spotify');
            });

        Logger.verbose(LOGGING_TAG, `Search Spotify by link: ${spotifyLink.id}, ${JSON.stringify(searched)}`);

        if (!(searched instanceof SpotifyTrack)) return;

        if (!searched) return null;
        const track = searched as unknown as SpotifyTrack;
        return track;
    }

    public async searchYouTubeByYouTubeLink(youtubeLink: YouTubeLink) {
        // Search the url
        const searched: YouTubeVideo[] = await playdl.search('https://www.youtube.com/watch?v=' + youtubeLink.videoId, {
            source: { youtube: 'video' }
        });

        Logger.verbose(
            LOGGING_TAG,
            `Search YouTube by link (Pass 1): ${youtubeLink.videoId}, Total result: ${
                searched.length
            }, ${JSON.stringify(searched)}`
        );

        for (let video of searched) {
            if (video.id === youtubeLink.videoId) return video;
        }

        // Serch the video Id
        const searched2: YouTubeVideo[] = await playdl.search(youtubeLink.videoId, {
            source: { youtube: 'video' }
        });

        Logger.verbose(
            LOGGING_TAG,
            `Seach YouTube by video ID (Pass 2): ${youtubeLink.videoId}, Total result: ${
                searched2.length
            }, ${JSON.stringify(searched2)}`
        );

        for (let video of searched2) {
            if (video.id === youtubeLink.videoId) return video;
        }

        // Last resort, search the title
        const videoInfo = await playdl.video_basic_info('https://www.youtube.com/watch?v=' + youtubeLink.videoId);
        if (videoInfo?.video_details?.title) {
            const searched: YouTubeVideo[] = await playdl.search(videoInfo.video_details.title, {
                source: { youtube: 'video' }
            });

            Logger.verbose(
                LOGGING_TAG,
                `Search YouTube by title (Pass 3): ${videoInfo.video_details.title}, Total result: ${
                    searched.length
                }, ${JSON.stringify(searched)}`
            );

            for (let video of searched) {
                if (video.id === youtubeLink.videoId) return video;
            }
        }

        let yt_info = await playdl.video_info('https://www.youtube.com/watch?v=' + youtubeLink.videoId);

        if (yt_info) {
            return new YouTubeVideo({
                id: yt_info.video_details.id,
                url: yt_info.video_details.url,
                type: yt_info.video_details.type,
                title: yt_info.video_details.title,
                description: yt_info.video_details.description,
                durationRaw: yt_info.video_details.durationRaw,
                durationInSec: yt_info.video_details.durationInSec,
                uploadedAt: yt_info.video_details.uploadedAt,
                upcoming: yt_info.video_details.upcoming,
                views: yt_info.video_details.views,
                thumbnails: yt_info.video_details.thumbnails,
                channel: yt_info.video_details.channel,
                likes: yt_info.video_details.likes,
                live: yt_info.video_details.live,
                liveAt: yt_info.video_details.liveAt,
                private: yt_info.video_details.private,
                tags: yt_info.video_details.tags,
                discretionAdvised: yt_info.video_details.discretionAdvised,
                music: yt_info.video_details.music
            });
        }

        return null;
    }

    public async getYouTubeSongsInPlayList(youtubeLink: string) {
        const result = await playdl.playlist_info(youtubeLink, {
            incomplete: true
        });
        Logger.verbose(LOGGING_TAG, `Get YouTube songs in playlist: ${youtubeLink}, ${JSON.stringify(result)}`);
        return result;
    }

    public async getSpotifySongsInPlayList(spotifyLink: string) {
        if (playdl.is_expired()) {
            Logger.debug(LOGGING_TAG, 'Spotify token expired, refreshing...');
            await playdl.refreshToken();
        }

        const result = await playdl.spotify(spotifyLink).catch((err) => {
            Logger.error(err.message);
            throw new Error('Error while searching on Spotify');
        });

        Logger.verbose(LOGGING_TAG, `Get Spotify songs in playlist: ${spotifyLink}, ${JSON.stringify(result)}`);

        if (!(result.type == 'playlist' || result.type == 'album')) throw new Error('Not a spotify playlist');

        return result as unknown as SpotifyPlaylist;
    }

    public isYouTubeLink(link: string): boolean {
        try {
            this.parseYouTubeLink(link);
            return true;
        } catch (err) {
            return false;
        }
    }

    public isSpotifyLink(link: string): boolean {
        try {
            this.parseSpotifyLink(link);
            return true;
        } catch (err) {
            return false;
        }
    }

    public parseYouTubeLink(query: string): YouTubeLink {
        if (
            query.startsWith('https://www.youtube.com/watch?v=') ||
            query.startsWith('http://www.youtube.com/watch?v=') ||
            query.startsWith('https://music.youtube.com/watch?v=') ||
            query.startsWith('https://music.youtube.com/watch?v=')
        ) {
            let data = this.parseURLQuery(query);
            if (!data.v) throw new Error('YouTube link is invalid');
            return {
                videoId: data.v,
                list: data.list ? (data.list !== 'RDMM' ? data.list : undefined) : undefined
            };
        } else if (query.startsWith('https://youtu.be/') || query.startsWith('http://youtu.be/')) {
            //Get youtube video id after the url
            let videoId = query.split('/')[3];

            if (!videoId) throw new Error('YouTube link is invalid');
            if (query.split('/')[4]) throw new Error('YouTube link is invalid');

            return {
                videoId: videoId
            };
        } else if (
            query.startsWith('https://www.youtube.com/playlist?list=') ||
            query.startsWith('http://www.youtube.com/playlist?list=')
        ) {
            let listId = query.split('?list=')[1];
            return {
                videoId: '',
                list: listId
            };
        } else {
            throw new Error('YouTube link is invalid');
        }
    }

    public parseSpotifyLink(query: string): SpotifyLink {
        if (query.startsWith('https://open.spotify.com/track/')) {
            let id = query.split('/')[4].split(/[?#]/)[0];
            return {
                id: id,
                type: 'track',
                url: query.split(/[?#]/)[0]
            };
        } else if (query.startsWith('https://open.spotify.com/album/')) {
            let id = query.split('/')[4].split(/[?#]/)[0];
            return {
                id: id,
                type: 'album',
                url: query.split(/[?#]/)[0]
            };
        } else if (query.startsWith('https://open.spotify.com/playlist/')) {
            let id = query.split('/')[4].split(/[?#]/)[0];
            return {
                id: id,
                type: 'playlist',
                url: query.split(/[?#]/)[0]
            };
        } else {
            throw new Error('Spotify link is invalid');
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
