import Logger from "../libs/Logger";
import DiscordProvider from "../providers/Discord";
import { ApplicationCommand, Collection } from "discord.js"
import { SlashCommandBuilder } from "@discordjs/builders";

export const GLOBAL_COMMANDS: Object[] = [];

export const GUILD_COMMANDS: Object[] = [];

GUILD_COMMANDS.push(new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help menu')
);
GUILD_COMMANDS.push(new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Measure network latency')
);
GUILD_COMMANDS.push(new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Invite me to your server!')
);
GUILD_COMMANDS.push(new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make me say something')
    .addStringOption(option => option
        .setName('message')
        .setDescription('Message you want me to say')
        .setRequired(true)
    )
);
GUILD_COMMANDS.push(new SlashCommandBuilder()
    .setName('interaction')
    .setDescription('[Developer Only] Manage interaction')
    .addSubcommand(info => info
        .setName('info')
        .setDescription('[Developer Only] Interaction modules information')
    )
    .addSubcommand(reloadAll => reloadAll
        .setName('reloadall')
        .setDescription('[Developer Only] Reload interaction for global and all guilds')
    )
);
GUILD_COMMANDS.push(new SlashCommandBuilder()
    .setName('membershipscreening')
    .setDescription('Membership screening')
    .addSubcommand(info => info
        .setName('info')
        .setDescription('Show more information for membership screening')
    )
    .addSubcommand(enable => enable
        .setName('enable')
        .setDescription('Enable membership screening')
    )
    .addSubcommand(enable => enable
        .setName('disable')
        .setDescription('Disable membership screening')
    )
    .addSubcommand(setrole => setrole
        .setName('setrole')
        .setDescription('Set a role that user will be granted when approved to join')
        .addRoleOption(option => option
            .setName('role')
            .setDescription('Select a role that user will be granted when approved to join')
            .setRequired(true)
        )
    )
    .addSubcommand(setchannel => setchannel
        .setName('setchannel')
        .setDescription('Set channel where membership screening approval request will be sent')
        .addChannelOption(option => option
            .setName('channel')
            .setDescription('Select a channel where approval request will be sent')
            .setRequired(true)
        )
    )
    .addSubcommand(createmessage => createmessage
        .setName('createmessage')
        .setDescription('Create greeting message for membership screening into the channel. A message for new commers to read')
    )
);

export const registerAllGlobalCommands = async () => {
    Logger.log('info', `Registering all global interaction commands`);
    await DiscordProvider.client.application?.commands.set(JSON.parse(JSON.stringify(GLOBAL_COMMANDS)));
}

export const unregisterAllGlobalCommands = async () => {
    //const commands = await DiscordProvider.client.application?.commands.fetch();

    //if(typeof commands === 'undefined') return;
    //if(commands.size === 0) return;

    Logger.log('info', `Unregistering all global interaction commands`);
    await DiscordProvider.client.application?.commands.set([]);
    /*for(const command of commands) {
        await DiscordProvider.client.application?.commands.delete(command[1]);
    }*/

}

export const registerAllGuildsCommands = async () => {
    const guilds = DiscordProvider.client.guilds.cache.map(guild => guild.id);

    for(const guild of guilds) {
        const guildObject = DiscordProvider.client.guilds.cache.get(guild);

        if(!guildObject) continue;
        
        Logger.log('info', `Registering all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
        await DiscordProvider.client.guilds.cache.get(guildObject.id)?.commands.set(JSON.parse(JSON.stringify(GUILD_COMMANDS)));
    }
}

export const unregisterAllGuildsCommands = async () => {
    const guilds = DiscordProvider.client.guilds.cache.map(guild => guild.id);

    for(const guild of guilds) {

        const guildObject = DiscordProvider.client.guilds.cache.get(guild);

        if(!guildObject) continue;

        Logger.log('info', `Unregistering all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
        await DiscordProvider.client.guilds.cache.get(guildObject.id)?.commands.set([]);

        //const commands = await guildObject.commands.fetch();

        //if(commands.size === 0) continue;
        /*for(const command of commands) {
            try {
                await DiscordProvider.client.guilds.cache.get(guildObject.id)?.commands.delete(command[1]);
            } catch(err) {
                Logger.log('error', `Cannot unregister all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
            }
        }*/
        
    }
}