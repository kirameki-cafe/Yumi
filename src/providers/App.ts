import Logger from '../libs/Logger';

import Environment from './Environment';
import Prisma from './Prisma';
import Discord from './Discord';
import osu from './osu';

class App {

    public readonly version = '0.01';

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