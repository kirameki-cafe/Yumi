import Prisma from "./Prisma";

class Cache {

    private cache: any;

    constructor () {
        this.cache = {
            Guilds: {

            }
        };
    }

    public async updateGuildsCache() {
        const Guilds = await Prisma.client.guild.findMany();
        for(let Guild of Guilds) {
            this.setGuildData(Guild.id, Guild);
        }
    }

    public setGuildData(id: string, data: Object): void {
        this.cache.Guilds[id] = data;
    }

    public async getGuild(id: string) {
        if(typeof this.cache.Guilds[id] !== 'undefined')
            return this.cache.Guilds[id];

        const Guild = await Prisma.client.guild.findFirst({
            where: {
                id: id
            }
        });

        if(Guild === null)
            return undefined;

        this.setGuildData(Guild.id, Guild);
        return this.cache.Guilds[id];

    }

    public getGuilds(): void {
        return this.cache.Guilds;
    }

}

export default new Cache();