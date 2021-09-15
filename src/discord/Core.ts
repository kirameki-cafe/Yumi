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

        // TODO : Make it cache guild on join

        await Cache.updateGuildsCache();
        // TODO: Better timer
        setInterval(() => {
            Cache.updateGuildsCache();
        }, 5 * 60 * 1000)
        
        if(DiscordProvider.client.user)
            DiscordProvider.client.user.setActivity("your heartbeat 💗", {
                type: "LISTENING"
            });
          

        Logger.info('Core started successfully');
        
    }
}
