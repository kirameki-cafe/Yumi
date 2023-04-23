import * as path from 'path';
import * as dotenv from 'dotenv';
import validator from 'validator';

import Logger from '../libs/Logger';

const requiredENV = [
    'NODE_ENV',
    'DATABASE_URL',
    'DISCORD_TOKEN',
    'PRIVATE_BOT',
    'IMGPROXY_HOST',
    'IMGPROXY_KEY',
    'IMGPROXY_SALT'
];

class Environment {
    public init(): void {
        dotenv.config({ path: path.resolve(__dirname, '../../.env') });

        for (let param of requiredENV) {
            if (this.isUndefinedOrEmpty(process.env[param])) throw new Error(`.env ${param} is undefined`);
        }

        // NODE_ENV Checks
        if (this.get().NODE_ENV != 'production' && this.get().NODE_ENV != 'development')
            throw new Error('.env NODE_ENV must be either "production" or "development"');

        // DISCORD_TOKEN Checks
        if (this.get().DISCORD_TOKEN.length != 59)
            throw new Error('.env DISCORD_TOKEN is not a valid discord bot token');

        // DEVELOPER_IDS Checks
        if (this.get().DEVELOPER_IDS) {
            let developerIds = this.get().DEVELOPER_IDS.split(',');
            for (let id of developerIds) {
                if (isNaN(parseInt(id))) throw new Error(`.env DEVELOPER_IDS contains an invalid id: ${id}`);
            }
        }

        // PRIVATE_BOT Checks
        if (this.get().PRIVATE_BOT.toLowerCase() != 'true' && this.get().PRIVATE_BOT.toLowerCase() != 'false')
            throw new Error('.env PRIVATE_BOT must be either "true" or "false"');

        // SUPPORT_URL Checks
        if (this.get().SUPPORT_URL && !validator.isURL(this.get().SUPPORT_URL))
            throw new Error('.env SUPPORT_URL is not a valid URL');

        // WEB_HOST Checks
        if (
            this.get().WEB_HOST &&
            this.get().WEB_HOST.toLowerCase() != 'localhost' &&
            !validator.isIP(this.get().WEB_HOST)
        )
            throw new Error('.env WEB_HOST must be either localhost or a valid IP address');

        // WEB_PORT Checks
        if (this.get().WEB_PORT && !validator.isPort(this.get().WEB_PORT))
            throw new Error('.env WEB_PORT must be a valid port number');

        // YOUTUBE_COOKIE_BASE64 Checks
        if (this.get().YOUTUBE_COOKIE_BASE64 && !validator.isBase64(this.get().YOUTUBE_COOKIE_BASE64))
            throw new Error('.env YOUTUBE_COOKIE_BASE64 must be a valid base64 string');

        Logger.log('info', `Running in ${process.env.NODE_ENV} environment`);
    }

    public get(): any {
        const NODE_ENV = process.env.NODE_ENV;

        const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
        const DEVELOPER_IDS = process.env.DEVELOPER_IDS;
        const PRIVATE_BOT = process.env.PRIVATE_BOT;
        const SUPPORT_URL = process.env.SUPPORT_URL;

        const WEB_HOST = process.env.WEB_HOST;
        const WEB_PORT = process.env.WEB_PORT;

        const OSU_API_KEY = process.env.OSU_API_KEY;
        const YOUTUBE_COOKIE_BASE64 = process.env.YOUTUBE_COOKIE_BASE64;

        const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
        const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
        const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
        const SPOTIFY_CLIENT_MARKET = process.env.SPOTIFY_CLIENT_MARKET;

        const VRC_CONTACT_EMAIL = process.env.VRC_CONTACT_EMAIL;
        const VRC_API_KEY = process.env.VRC_API_KEY;
        const VRC_COOKIE = process.env.VRC_COOKIE;

        const IMGPROXY_HOST = process.env.IMGPROXY_HOST;
        const IMGPROXY_KEY = process.env.IMGPROXY_KEY;
        const IMGPROXY_SALT = process.env.IMGPROXY_SALT;

        return {
            NODE_ENV,

            DISCORD_TOKEN,
            DEVELOPER_IDS,
            PRIVATE_BOT,
            SUPPORT_URL,

            WEB_HOST,
            WEB_PORT,

            OSU_API_KEY,
            YOUTUBE_COOKIE_BASE64,

            SPOTIFY_CLIENT_ID,
            SPOTIFY_CLIENT_SECRET,
            SPOTIFY_REFRESH_TOKEN,
            SPOTIFY_CLIENT_MARKET,

            VRC_CONTACT_EMAIL,
            VRC_API_KEY,
            VRC_COOKIE,

            IMGPROXY_HOST,
            IMGPROXY_KEY,
            IMGPROXY_SALT
        };
    }

    private isUndefinedOrEmpty(value: String | undefined): boolean {
        if (typeof value === 'undefined') return true;

        if (value === undefined) return true;

        if (value === '') return true;

        return false;
    }
}

export default new Environment();
