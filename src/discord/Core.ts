import DiscordModule from "../utils/DiscordModule";

import { Guild } from "discord.js";
import Logger from "../libs/Logger";
import Cache from "../providers/Cache";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";

export default class Core extends DiscordModule {

    public id: string = "Discord_Core";

    async Ready() {

        let data = [];
        for(let Guild of DiscordProvider.client.guilds.cache.map(guild => guild)) {
            data.push({ id: Guild.id });
        }

        await Prisma.client.guild.createMany({
            data: data,
            skipDuplicates: true
        });

        await Cache.updateGuildsCache();
        setInterval(() => {
            Cache.updateGuildsCache();
        }, 5 * 60 * 1000)

        setInterval(() => {
            DiscordProvider.client.user!.setActivity("for your heart 💖", {
                type: "COMPETING"
            });
        }, 5 * 60 * 1000)
        
        Logger.info('Core started successfully');
        
    }
    
    async GuildCreate(guild: Guild) {
        if(await Prisma.client.guild.findFirst({ where: {id: guild.id} })) return;

        await Prisma.client.guild.create({
            data: {
                id: guild.id
            }
        });

        await Cache.updateGuildCache(guild.id);
    }
}
