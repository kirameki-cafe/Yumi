import {Client, Intents, TextChannel} from "discord.js";

import Logger from "../libs/Logger";
import Environment from "./Environment";

import Discord_Core from "../discord/core";
import Discord_Ping from "../discord/ping";
import Cache from "./Cache";

class Discord {

    public client: Client;
    private loaded_module: any;

    constructor () {
        this.client = new Client({ 
            partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
            intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
        });
        this.loaded_module = {};
    }

    public init(): void {
        Logger.info('Logging in to discord');
        this.client.login(Environment.get().DISCORD_TOKEN);
        
        this.loaded_module["Core"] = new Discord_Core();
        this.loaded_module["Ping"] = new Discord_Ping();

        for(const module in this.loaded_module) {
            let thisModule = this.loaded_module[module];
            
            if (typeof thisModule.init === "function")
                thisModule.init();
        }

        this.client.on("ready", () => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.ready === "function")
                    thisModule.ready();
            }
        });

        this.client.on("messageCreate", message => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.messageCreate === "function")
                    thisModule.messageCreate(message);
            }
        });

        // Handling commands
        this.client.on("messageCreate", async (message) => {

            // TODO: Handle DMs commands soon
            if(!(message.channel instanceof TextChannel)) return;
            if(message.author.bot) return;

            if(typeof message.guild?.id === 'undefined') return;

            let GuildCache = await Cache.getGuild(message.guild.id);
            if(typeof GuildCache === 'undefined' || typeof GuildCache.prefix === 'undefined') return;

            if(!message.content.startsWith(GuildCache.prefix)) return;

            let args = message.content.split(" ");
            let command = args[0].replace(GuildCache.prefix, '');
            args.shift();
            args = args.filter(e => e !== '');

            if(args.length === 0)
                args = [];

            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.onCommand === "function")
                    thisModule.onCommand(command, args, message);
            }
        });

    }

}

export default new Discord();
