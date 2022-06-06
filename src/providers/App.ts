import Environment from './Environment';
import Configuration from './Configuration';
import Prisma from './Prisma';
import Discord from './Discord';
import osu from './osuAPI';

import Logger from '../libs/Logger';
class App {
    public readonly versionNumber = `0.09`;
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

    public load_osu(): void {
        Logger.log('info', 'Loading osu! Client');
        osu.init();
    }
}

export default new App();
