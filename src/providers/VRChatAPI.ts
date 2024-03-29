import * as VRChat from 'vrchat';
import Environment from './Environment';
import Logger from '../libs/Logger';
import App from './App';

const LOGGING_TAG = '[VRChatAPI]';
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

        Logger.debug(LOGGING_TAG, `Using user agent ${this.useragent}`);
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

        Logger.info(LOGGING_TAG, 'Logging in to VRChat');

        let res;
        try {
            res = await this.client.AuthenticationApi.getCurrentUser();
        } catch (err: any) {
            if (err.response?.status === 401) {
                Logger.error(LOGGING_TAG, 'Unable to log in, check your credentials');
                return;
            } else throw err;
        }

        if ((res.data as any).requiresTwoFactorAuth) {
            Logger.error(
                LOGGING_TAG,
                'Two factor authentication is required, please authenticate',
                (res.data as any).requiresTwoFactorAuth
            );
            Logger.info(LOGGING_TAG, `Auth Cookie: ${this.configuration.baseOptions.headers.Cookie}`);
            return;
        }

        this.ready = true;
        Logger.info(LOGGING_TAG, 'Logged in to VRChat as ' + res.data.displayName);

        setInterval(() => {
            for (let key in this.cache.Users) {
                if (this.cache.Users[key].expires < new Date()) {
                    Logger.debug(LOGGING_TAG, `Removing user ${key} from cache (expired)`);
                    delete this.cache.Users[key];
                }
            }
            for (let key in this.cache.Worlds) {
                if (this.cache.Worlds[key].expires < new Date()) {
                    Logger.debug(LOGGING_TAG, `Removing world ${key} from cache (expired)`);
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
            if (this.cache.Users[id].expires > new Date()) {
                Logger.debug(LOGGING_TAG, `Cache hit for user ${id}`);
                Logger.verbose(LOGGING_TAG, `Cache hit for user ${id}, ${JSON.stringify(this.cache.Users[id].user)}}`);
                return this.cache.Users[id].user;
            }
            Logger.debug(LOGGING_TAG, `Cache hit for user ${id} but expired, refreshing`);
        }

        Logger.debug(LOGGING_TAG, `Looking up user ${id} in VRChat API`);
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

        Logger.debug(LOGGING_TAG, `Caching user ${id}`);
        this.cache.Users[id] = {
            user: user.data,
            expires: new Date(Date.now() + VRC_CACHE_DURATION)
        };
        return user.data;
    }

    public async getCachedWorldById(id: string) {
        if (typeof this.cache.Worlds[id] !== 'undefined') {
            if (this.cache.Worlds[id].expires > new Date()) {
                Logger.debug(LOGGING_TAG, `Cache hit for world ${id}`);
                Logger.verbose(
                    LOGGING_TAG,
                    `Cache hit for world ${id}, ${JSON.stringify(this.cache.Worlds[id].world)}}`
                );
                return this.cache.Worlds[id].world;
            }
            Logger.debug(LOGGING_TAG, `Cache hit for world ${id} but expired, refreshing`);
        }

        Logger.debug(LOGGING_TAG, `Looking up world ${id} in VRChat API`);
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

        Logger.debug(LOGGING_TAG, `Caching world ${id}`);
        Logger.verbose(LOGGING_TAG, `Caching world ${id}, ${JSON.stringify(world.data)}}`);
        this.cache.Worlds[id] = {
            world: world.data,
            expires: new Date(Date.now() + VRC_CACHE_DURATION)
        };
        return world.data;
    }

    public end(): void {}
}

export default new VRChatAPI();
