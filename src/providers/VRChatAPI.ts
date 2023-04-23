import * as VRChat from 'vrchat';
import Environment from './Environment';
import Logger from '../libs/Logger';
import App from './App';

const VRC_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface VRChatAPIs {
    AuthenticationApi: VRChat.AuthenticationApi;
    UsersApi: VRChat.UsersApi;
    WorldsApi: VRChat.WorldsApi;
}

interface UserCache {
    user: VRChat.User;
    expires: Date;
}

interface WorldCache {
    world: VRChat.World;
    expires: Date;
}

interface Cache {
    Users: { [key: string]: UserCache };
    Worlds: { [key: string]: WorldCache };
}

class VRChatAPI {
    public client: VRChatAPIs | null;
    public configuration: VRChat.Configuration | null;
    private ready = false;
    private cache: Cache;
    private useragent: string | null = null;

    constructor() {
        this.cache = {
            Users: {},
            Worlds: {}
        };
        this.client = null;
        this.configuration = null;
    }

    public async init() {
        this.useragent = `Yumi/${App.version.replaceAll('/', '').replaceAll(' ', '-').replaceAll('--', '-')} ${
            Environment.get().VRC_CONTACT_EMAIL
        }`;
        Logger.debug(`[VRChat] Using user agent ${this.useragent}`);
        this.configuration = new VRChat.Configuration({
            //username: Environment.get().VRC_USERNAME,
            //;password: Environment.get().VRC_PASSWORD,
            apiKey: Environment.get().VRC_API_KEY,
            baseOptions: {
                headers: {
                    'User-Agent': this.useragent,
                    'Content-Type': 'application/json',
                    Cookie: Environment.get().VRC_COOKIE || ''
                }
            }
        });

        this.client = {
            AuthenticationApi: new VRChat.AuthenticationApi(this.configuration),
            UsersApi: new VRChat.UsersApi(this.configuration),
            WorldsApi: new VRChat.WorldsApi(this.configuration)
        };

        Logger.info('Logging in to VRChat');

        let res;
        try {
            res = await this.client.AuthenticationApi.getCurrentUser();
        } catch (err: any) {
            if (err.response?.status === 401) {
                Logger.error('Unable to log in to VRChat, check your credentials');
                return;
            } else throw err;
        }

        this.ready = true;
        Logger.info('Logged in to VRChat as ' + res.data.displayName);

        setInterval(() => {
            for (let key in this.cache.Users) {
                if (this.cache.Users[key].expires < new Date()) {
                    Logger.debug('[VRChat] [Cache] Removing user ' + key + ' from cache');
                    delete this.cache.Users[key];
                }
            }
            for (let key in this.cache.Worlds) {
                if (this.cache.Worlds[key].expires < new Date()) {
                    Logger.debug('[VRChat] [Cache] Removing world ' + key + ' from cache');
                    delete this.cache.Worlds[key];
                }
            }
        }, VRC_CACHE_DURATION);
    }

    public async reInit() {
        Logger.info(LOGGING_TAG, 'Re-initializing VRChat API');
        this.ready = false;
        this.client = null;
        this.configuration = null;
        await this.init();
    }

    public async loginEmailOtp(otp: string) {
        if (this.ready) throw new Error('Already logged in');
        let res;
        try {
            res = await this.client!.AuthenticationApi.verify2FAEmailCode({
                code: otp
            });
        } catch (err: any) {
            if (err.response?.status === 400) {
                Logger.error(LOGGING_TAG, 'Unable to log in, invalid OTP');
                throw new Error('Invalid OTP');
            } else if (err.response?.status === 401) {
                Logger.error(LOGGING_TAG, 'Unable to log in, invalid auth cookie');
                throw new Error('Invalid auth cookie');
            } else throw err;
        }
    }

    public isReady(): boolean {
        return this.ready;
    }

    public async getCachedUserById(id: string) {
        if (typeof this.cache.Users[id] !== 'undefined') {
            Logger.debug('[VRChat] [Cache] Cache hit for user ' + id);
            if (this.cache.Users[id].expires > new Date()) {
                return this.cache.Users[id].user;
            }
        }

        Logger.debug('[VRChat] [Cache] Cache miss for ' + id);
        let user;
        try {
            user = await this.client!.UsersApi.getUser(id);
        } catch (err: any) {
            if (err.response?.status === 404) return null;
            throw err;
        }

        if (!user) {
            return null;
        }

        Logger.debug('[VRChat] [Cache] Caching user ' + id);
        this.cache.Users[id] = {
            user: user.data,
            expires: new Date(Date.now() + VRC_CACHE_DURATION)
        };
        return user.data;
    }

    public async getCachedWorldById(id: string) {
        if (typeof this.cache.Worlds[id] !== 'undefined') {
            Logger.debug('[VRChat] [Cache] Cache hit for world ' + id);
            if (this.cache.Worlds[id].expires > new Date()) {
                return this.cache.Worlds[id].world;
            }
        }

        Logger.debug('[VRChat] [Cache] Cache miss for ' + id);
        let world;
        try {
            world = await this.client!.WorldsApi.getWorld(id);
        } catch (err: any) {
            if (err.response?.status === 404) return null;
            throw err;
        }

        if (!world) {
            return null;
        }

        Logger.debug('[VRChat] [Cache] Caching world ' + id);
        this.cache.Worlds[id] = {
            world: world.data,
            expires: new Date(Date.now() + VRC_CACHE_DURATION)
        };

        return world.data;
    }

    public end(): void {}
}

export default new VRChatAPI();
