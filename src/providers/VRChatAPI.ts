import { Configuration, AuthenticationApi, UsersApi, WorldsApi } from 'vrchat';
import Environment from './Environment';
import Logger from '../libs/Logger';

import App from './App';

interface VRChatAPIs {
    AuthenticationApi: AuthenticationApi;
    UsersApi: UsersApi;
    WorldsApi: WorldsApi;
}

class VRChatAPI {
    public client: VRChatAPIs | null;
    public configuration: Configuration | null;

    constructor() {
        this.client = null;
        this.configuration = null;
    }

    public async init() {
        this.configuration = new Configuration({
            //username: Environment.get().VRC_USERNAME,
            //;password: Environment.get().VRC_PASSWORD,
            apiKey: Environment.get().VRC_API_KEY,
            baseOptions: {
                headers: {
                    'User-Agent': `Yumi/${App.version.replaceAll('/', '').replaceAll(' ', '-').replaceAll('--', '-')} ${
                        Environment.get().VRC_CONTACT_EMAIL
                    }`,
                    'Content-Type': 'application/json',
                    Cookie: Environment.get().VRC_COOKIE || ''
                }
            }
        });

        this.client = {
            AuthenticationApi: new AuthenticationApi(this.configuration),
            UsersApi: new UsersApi(this.configuration),
            WorldsApi: new WorldsApi(this.configuration)
        };

        Logger.info('Logging in to VRChat');
        let res = await this.client.AuthenticationApi.getCurrentUser();

        Logger.info('Logged in to VRChat as ' + res.data.displayName);
    }

    public end(): void {}
}

export default new VRChatAPI();
