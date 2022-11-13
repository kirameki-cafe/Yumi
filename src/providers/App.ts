import Environment from './Environment';
import Configuration from './Configuration';
import Prisma from './Prisma';
import Discord from './Discord';
import osu from './osuAPI';
import Express from './Express';

import Logger from '../libs/Logger';
import Locale from './Locale';
class App {
    public readonly versionNumber = `0.11`;
    public readonly version = `${this.versionNumber}${
        Environment.get().NODE_ENV === 'development' ? ' / Development Build' : ''
    }`;

    public loadConfig(): void {
        Logger.log('info', 'Loading configuration');
        Configuration.init();
    }

    public loadENV(): void {
        Logger.log('info', 'Loading environment');
        Environment.init();
    }

    public loadPrisma(): void {
        Logger.log('info', 'Loading Prisma');
        Prisma.init();
    }

    public loadDiscord(): void {
        Logger.log('info', 'Loading Discord Client');
        Discord.init();
    }

    public loadLocale(): void {
        Logger.log('info', 'Loading Locale');
        Locale.init();
    }

    public load_osu(): void {
        Logger.log('info', 'Loading osu! Client');
        osu.init();
    }

    public loadExpress(): void {
        if (!Environment.get().WEB_HOST || !Environment.get().WEB_PORT) {
            Logger.log('warn', 'WEB_HOST or WEB_PORT is not defined in .env, not starting web server');
            return;
        }
        Logger.log('info', 'Loading Express');
        Express.init();
    }

    public endExpress(): void {
        Logger.log('info', 'Ending Express');
        Express.end();
    }
}

export default new App();
