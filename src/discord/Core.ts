import { ActivityType, Guild } from 'discord.js';

import DiscordModule from '../utils/DiscordModule';
import DiscordProvider from '../providers/Discord';

import Logger from '../libs/Logger';
import Cache from '../providers/Cache';
import Prisma from '../providers/Prisma';

const LOGGING_TAG = '[DiscordCore]';

export default class Core extends DiscordModule {
    public id: string = 'Discord_Core';

    async Ready() {
        let data = [];
        for (let Guild of DiscordProvider.client.guilds.cache.map((guild) => guild)) {
            data.push({ id: Guild.id });
        }

        await Prisma.client.guild.createMany({
            data: data,
            skipDuplicates: true
        });

        await Cache.updateGuildsCache();
        setInterval(() => {
            Cache.updateGuildsCache();
        }, 5 * 60 * 1000);

        this.setActivity();
        setInterval(() => {
            Logger.verbose(LOGGING_TAG, 'Updating activity');
            this.setActivity();
        }, 5 * 60 * 1000);

        Logger.info(LOGGING_TAG, 'Core started successfully');
    }

    async GuildCreate(guild: Guild) {
        Logger.info(LOGGING_TAG, `Joined guild ${guild.name} (${guild.id})`);
        if (await Prisma.client.guild.findFirst({ where: { id: guild.id } })) return;

        await Prisma.client.guild.create({
            data: {
                id: guild.id
            }
        });

        await Cache.updateGuildCache(guild.id);
    }

    private setActivity() {
        DiscordProvider.client.user!.setActivity('for your heart 💖', {
            type: ActivityType.Competing
        });
    }
}
