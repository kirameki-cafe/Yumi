import {Client, Guild, GuildMember, Intents, Interaction, Message, TextChannel} from "discord.js";

import Logger from "../libs/Logger";
import Environment from "./Environment";

import Discord_Core from "../discord/Core";
import Discord_Settings from "../discord/Settings";
import Discord_Ping from "../discord/Ping";
import Discord_Help from "../discord/Help";
import Discord_Invite from "../discord/Invite";
import Discord_Say from "../discord/Say";
import Discord_InteractionManager from "../discord/InteractionManager";
import Discord_MembershipScreening from "../discord/MembershipScreening";
import Cache from "./Cache";

class Discord {

    public client: Client;
    private loaded_module: any;

    constructor () {
        this.client = new Client({ 
            partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
            intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS]
        });
        this.loaded_module = {};
    }

    public init(): void {
        Logger.info('Logging in to discord');
        this.client.login(Environment.get().DISCORD_TOKEN);
        

        // TODO: Improve this
        this.loaded_module["Core"] = new Discord_Core();
        this.loaded_module["Discord_Settings"] = new Discord_Settings();
        this.loaded_module["Discord_Ping"] = new Discord_Ping();
        this.loaded_module["Discord_Help"] = new Discord_Help();
        this.loaded_module["Discord_Invite"] = new Discord_Invite();
        this.loaded_module["Discord_InteractionManager"] = new Discord_InteractionManager();
        this.loaded_module["Discord_Say"] = new Discord_Say();
        this.loaded_module["MembershipScreening"] = new Discord_MembershipScreening();

        for(const module in this.loaded_module) {
            let thisModule = this.loaded_module[module];
            
            if (typeof thisModule.init === "function")
                thisModule.init();
        }

        // On bot logged in
        this.client.on("ready", () => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.ready === "function")
                    thisModule.ready();
            }
        });

        // Member join guild event to modules
        this.client.on("guildMemberAdd", (member: GuildMember) => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.guildMemberAdd === "function")
                    thisModule.guildMemberAdd(member);
            }
        });

        // Interaction create event to modules
        this.client.on("interactionCreate", (interaction: Interaction) => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.interactionCreate === "function")
                    thisModule.interactionCreate(interaction);
            }
        });

        // Message create event to modules
        this.client.on("messageCreate", (message: Message) => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.messageCreate === "function")
                    thisModule.messageCreate(message);
            }
        });

        // Joined guild event to modules
        this.client.on("guildCreate", (guild : Guild) => {
            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.guildCreate === "function")
                    thisModule.guildCreate(guild);
            }
        });

        // Handling commands
        this.client.on("messageCreate", async (message: Message) => {

            // TODO: Handle DMs commands soon
            if(!(message.channel instanceof TextChannel)) return;
            if(message.author.bot) return;

            if(typeof message.guild?.id === 'undefined') return;

            let GuildCache = await Cache.getGuild(message.guild.id);
            if(typeof GuildCache === 'undefined' || typeof GuildCache.prefix === 'undefined') return;

            if(!message.content.startsWith(GuildCache.prefix)) return;

            let cachedPrefix = GuildCache.prefix;

            let args = message.content.split(" ");

            let skipIndex = 0;
            if((cachedPrefix.split(" ")[0] !== cachedPrefix)) {
                //skipIndex = (cachedPrefix.split(" ").length) - (args.length - (cachedPrefix.split(" ").length));
                skipIndex = (cachedPrefix.split(" ").length) - 1;

                //if(/^[A-Za-z0-9_.]+$/.test(cachedPrefix.split(" ")[cachedPrefix.split(" ").length - 1]))
                skipIndex++;
            }

            //if(/^[A-Za-z0-9_.]+$/.test(cachedPrefix.charAt(cachedPrefix.length - 1))) {
            if(![
                '!','@','#','$','%','^','&','*','(',')','-','=','_','+','\\','/','<','>','[',']','{','}','`','"',"'",',','.','~','|',';',':','?'
            ].includes(cachedPrefix.charAt(cachedPrefix.length - 1))) {
                cachedPrefix = cachedPrefix + " ";
               // if(!/^[A-Za-z0-9_.]+$/)
                    skipIndex++;
            } else if (
                (cachedPrefix.startsWith('<@!') && cachedPrefix.endsWith('>')) ||
                cachedPrefix.startsWith('<:') && cachedPrefix.endsWith('>') ||
                cachedPrefix.startsWith('<a:') && cachedPrefix.endsWith('>') ||
                cachedPrefix.startsWith('<#') && cachedPrefix.endsWith('>')
                ) {
                cachedPrefix = cachedPrefix + " ";
                skipIndex++;
            }

            if(typeof args[0 + skipIndex] === 'undefined') return;

            let command = args[0 + skipIndex].replace(cachedPrefix, '');

            if(command === '') return;

            for(let i = 0; i < (skipIndex + 1); i++) {
                args.shift();
            }        
            args = args.filter(e => e !== '');

            if(args.length === 0)
                args = [];

            for(const module in this.loaded_module) {
                let thisModule = this.loaded_module[module];
                
                if (typeof thisModule.onCommand === "function")
                    thisModule.onCommand(command, args, message);
            }
        });

        // Handling mentions
        this.client.on("messageCreate", async (message: Message) => {

            // TODO: Handle DMs commands soon
            if(!(message.channel instanceof TextChannel)) return;
            if(message.author.bot) return;

            if(typeof message.guild?.id === 'undefined') return;
            if(!message.mentions.users) return;

            if(message.mentions.users.first()?.id !== this.client.user?.id) return;
            if(!message.content.startsWith(`<@!${this.client.user?.id}>`)) return;

            let args = message.content.split(" ");
            let command = args[1];

            args.shift();
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
