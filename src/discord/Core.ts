import { Guild } from ".prisma/client";
import { Message } from "discord.js";
import Logger from "../libs/Logger";
import Cache from "../providers/Cache";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";

export default class Core {
    async ready() {

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
        
        DiscordProvider.client.user!.setActivity("for your heart 💖", {
            type: "COMPETING"
        });
        
        Logger.info('Core started successfully');
        
    }
    async guildCreate(guild: Guild) {
        if(await Prisma.client.guild.findFirst({ where: {id: guild.id} })) return;

        await Prisma.client.guild.create({
            data: {
                id: guild.id
            }
        });

        await Cache.updateGuildCache(guild.id);
    }
}
