import Logger from '../libs/Logger';

import Environment from './Environment';
import Prisma from './Prisma';
import Discord from './Discord';
import osu from './osuAPI';
import Configuration from './Configuration';

class App {

    public readonly version = `0.08${Environment.get().NODE_ENV === "development" ? ' / Development Build' : ''}`;

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

export default new App;