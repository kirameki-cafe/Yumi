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
import NekoMelody, { Player } from '../../NekoMelody/src/index';
import { YtDlpProvider } from '../../NekoMelody/src/providers';
import DiscordProvider from './Discord';
import Environment from './Environment';
import Logger from '../libs/Logger';
import EventEmitter from 'events';
import { AudioInformation } from '../../NekoMelody/src/providers/base';

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
    public discordPlayer: AudioPlayer;
    public nekoPlayer: Player;
    public textChannel?: BaseGuildTextChannel | BaseGuildVoiceChannel;
    public voiceChannel: VoiceChannel | StageChannel;
    public voiceConnection?: VoiceConnection;
    public previousTrack?: ValidTracks;

    public paused: boolean = false;
    public loopMode: DiscordMusicPlayerLoopMode = DiscordMusicPlayerLoopMode.None;

    public readonly events: EventEmitter;

    private providers = [new YtDlpProvider()];

    constructor({ voiceChannel }: { voiceChannel: VoiceChannel | StageChannel }) {
        this.queue = new Queue();
        this.discordPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
                maxMissedFrames: 1000
            }
        });
        this.nekoPlayer = NekoMelody.createPlayer(this.providers);
        this.voiceChannel = voiceChannel;
        this.events = new EventEmitter();

        // this.player.on(AudioPlayerStatus.Idle, async (oldStage, newStage) => {
        //     //The player stopped
        //     if (newStage.status === AudioPlayerStatus.Idle && oldStage.status !== AudioPlayerStatus.Idle) {
        //         // Loop mode is set to current song
        //         if (this.loopMode === DiscordMusicPlayerLoopMode.Current) {
        //             if (this.queue.track.length !== 0) {
        //                 this.previousTrack = this.queue.track[0];
        //                 this.playTrack(this.queue.track[0]);
        //             }
        //             return;
        //         }

        //         // There are more songs in the queue, remove finished song and play the next one
        //         if (this.queue.track.length !== 0) {
        //             let previousTrack = this.queue.track.shift();
        //             if (previousTrack) this.previousTrack = previousTrack;

        //             if (this.queue.track.length > 0) {
        //                 this.playTrack(this.queue.track[0]);
        //             }
        //         }
        //     }
        // });

        // this.player.on(AudioPlayerStatus.Playing, (oldState: any, newState: any) => {
        //     this.events.emit('playing', new PlayerPlayingEvent(this));
        // });

        // this.player.on('error', (error: Error) => {
        //     this.events.emit('error', new PlayerErrorEvent(this, error));
        // });

        this.nekoPlayer.on('play', (information: AudioInformation) => {
            if (!this.nekoPlayer.stream) throw new Error('No input stream');

            const resource = createAudioResource(this.nekoPlayer.stream, {
                //inlineVolume: true,
            });

            this.discordPlayer.play(resource);
            this.nekoPlayer.startCurrentStream();
            this.events.emit('playing', new PlayerPlayingEvent(this));
        });

        this.discordPlayer.on('stateChange', (oldState, newState) => {
            console.log('State change', oldState.status, newState.status);
            if (oldState.status === 'playing' && newState.status === 'idle') {
                this.nekoPlayer.endCurrentStream();
            }
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

        this.voiceConnection.subscribe(this.discordPlayer);

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
        if (this.discordPlayer) this.discordPlayer.pause();

        const guild = DiscordProvider.client.guilds.cache.get(this.voiceChannel.guild.id);
        if (!guild) return;

        if (guild.members.me?.voice) this.voiceConnection?.disconnect();
    }

    public async pausePlayer() {
        if (this.paused || !this.discordPlayer) return;
        if (!this.discordPlayer.pause(true)) throw new Error('Unable to pause player');
        this.paused = true;
    }

    public async resumePlayer() {
        if (!this.paused || !this.discordPlayer) return;
        if (!this.discordPlayer.unpause()) throw new Error('Unable to resume player');
        this.paused = false;
    }

    public async addTrackToQueue(track: ValidTracks) {
        return await this.nekoPlayer.enqueue(track.url);
    }

    public async skipTrack() {
        if (!this.voiceConnection) throw new Error('No voice connection');

        if (this.nekoPlayer.getQueue().length === 0) return;

        await this.nekoPlayer.skip();
        if (this.paused) this.paused = false;
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

    public getQueue() {
        return this.nekoPlayer.getQueue();
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
            if (this.voiceConnection.state.status !== 'destroyed') this.voiceConnection.destroy();
        }

        if (this.discordPlayer) {
            this.discordPlayer.stop(true);
        }

        this.textChannel = undefined;
        this.voiceConnection = undefined;
    }

    public async _fake_error_on_player() {
        const stream = 'https://fakestream:42069/fake/stream/fake/audio/fake.mp3';
        const resource = createAudioResource(stream);
        this.discordPlayer.play(resource);
        //this.player.emit('error', new AudioPlayerError(new Error('Music player was manually crashed'), null!));
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
            query.startsWith('https://www.youtube.com/shorts/') ||
            query.startsWith('http://www.youtube.com/shorts/')
        ) {
            let videoId = query.split('/')[4];

            if (!videoId) throw new Error('YouTube link is invalid');
            if (query.split('/')[5]) throw new Error('YouTube link is invalid');

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
