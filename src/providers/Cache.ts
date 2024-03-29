import { User, Guild } from '@prisma/client';
import { Snowflake } from 'discord-api-types/v10';
import Prisma from './Prisma';
import Logger from '../libs/Logger';

const LOGGING_TAG = '[PrismaCache]';

class Cache {
    private cache: {
        Guilds: { [key: Snowflake]: Guild };
        Users: { [key: Snowflake]: User };
    };

    constructor() {
        this.cache = {
            Guilds: {},
            Users: {}
        };
    }

    public async updateGuildsCache() {
        Logger.debug(LOGGING_TAG, 'Updating guilds cache');
        const Guilds = await Prisma.client.guild.findMany();
        for (let guild of Guilds) {
            this.setGuildCache(guild.id, guild);
        }
    }

    public async updateGuildCache(id: Snowflake) {
        Logger.debug(LOGGING_TAG, `Updating guild cache for ${id}`);
        const DBGuild = await Prisma.client.guild.findFirst({ where: { id: id } });

        // TODO: Try to fetch guild, create if not found or throw error
        if (DBGuild === null) return;
        this.setGuildCache(id, DBGuild);
    }

    public async updateUserCache(id: Snowflake) {
        Logger.debug(LOGGING_TAG, `Updating user cache for ${id}`);
        let user = await Prisma.client.user.findUnique({ where: { id } });
        if (!user) {
            user = await Prisma.client.user.create({
                data: {
                    id
                }
            });
        }
        this.setUserCache(user.id, user);
    }

    public async getCachedGuild(id: Snowflake): Promise<Guild | undefined> {
        if (typeof this.cache.Guilds[id] !== 'undefined') return this.cache.Guilds[id];

        const Guild = await Prisma.client.guild.findUnique({
            where: {
                id: id
            }
        });

        if (Guild === null) return undefined;

        this.setGuildCache(Guild.id, Guild);
        return this.cache.Guilds[id];
    }

    public async getCachedUser(id: Snowflake): Promise<User | undefined> {
        if (typeof this.cache.Users[id] !== 'undefined') {
            Logger.debug(LOGGING_TAG, `Cache hit for user ${id}`);
            return this.cache.Users[id];
        }

        Logger.debug(LOGGING_TAG, `Looking up user ${id} in Prisma`);
        const user = await Prisma.client.user.findUnique({
            where: {
                id: id
            }
        });

        if (user === null) return undefined;

        this.setUserCache(user.id, user);
        return this.cache.Users[id];
    }

    public setGuildCache(id: Snowflake, data: Guild): void {
        Logger.debug(LOGGING_TAG, `Caching guild ${id}`);
        this.cache.Guilds[id] = data;
    }

    public setUserCache(id: Snowflake, data: User): void {
        Logger.debug(LOGGING_TAG, `Caching user ${id}`);
        this.cache.Users[id] = data;
    }

    public isGuildCached(id: Snowflake) {
        return typeof this.cache.Guilds[id] !== 'undefined';
    }

    public isUserCached(id: Snowflake) {
        return typeof this.cache.Users[id] !== 'undefined';
    }

    public getCachedGuilds(): Object {
        return this.cache.Guilds;
    }

    public getCachedUsers(): Object {
        return this.cache.Users;
    }
}

export default new Cache();
