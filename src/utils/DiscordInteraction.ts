import Logger from "../libs/Logger";
import DiscordProvider from "../providers/Discord";
import { ApplicationCommand } from "discord.js"

export const GLOBAL_COMMANDS = [

];

export const GUILD_COMMANDS = [
    {
        name: 'help',
        description: 'Show help menu'
    },
    {
        name: 'ping',
        description: 'Measure network latency'
    },
    {
        name: 'invite',
        description: 'Invite me to your server!'
    },
    {
        name: 'say',
        description: 'Make me say something',
        options: [
            {
                name: 'message',
                type: 3,
                description: 'Message you want me to say',
                required: true
            }
        ]
    }
];

export const registerAllGlobalCommands = async () => {
    Logger.log('info', `Registering all global interaction commands`);
    await DiscordProvider.client.application?.commands.set(GLOBAL_COMMANDS);
}

export const unregisterAllGlobalCommands = async () => {
    const commands = await DiscordProvider.client.application?.commands.fetch();

    if(typeof commands === 'undefined') return;
    if(commands.size === 0) return;

    Logger.log('info', `Unregistering all global interaction commands`);
    for(const command of commands) {
        await DiscordProvider.client.application?.commands.delete(command[1]);
    }

}

export const registerAllGuildsCommands = async () => {
    const guilds = DiscordProvider.client.guilds.cache.map(guild => guild.id);

    for(const guild of guilds) {
        const guildObject = DiscordProvider.client.guilds.cache.get(guild);

        if(!guildObject) continue;
        
        Logger.log('info', `Registering all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
        await DiscordProvider.client.guilds.cache.get(guildObject.id)?.commands.set(GUILD_COMMANDS);
    }
}

export const unregisterAllGuildsCommands = async () => {
    const guilds = DiscordProvider.client.guilds.cache.map(guild => guild.id);

    for(const guild of guilds) {

        const guildObject = DiscordProvider.client.guilds.cache.get(guild);

        if(!guildObject) continue;

        const commands = await guildObject.commands.fetch();

        if(commands.size === 0) continue;

        Logger.log('info', `Unregistering all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
        for(const command of commands) {
            try {
                await DiscordProvider.client.guilds.cache.get(guildObject.id)?.commands.delete(command[1]);
            } catch(err) {
                Logger.log('error', `Cannot unregister all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
            }
        }
    }
}