import Logger from "../libs/Logger";
import DiscordProvider from "../providers/Discord";
import { ApplicationCommand, Collection } from "discord.js"
import { SlashCommandBuilder } from "@discordjs/builders";

export const GLOBAL_COMMANDS: Object[] = [];

export const GUILD_COMMANDS: Object[] = [];

GUILD_COMMANDS.push(new SlashCommandBuilder().setName('help').setDescription('Show help menu').toJSON());
GUILD_COMMANDS.push(new SlashCommandBuilder().setName('ping').setDescription('Measure network latency').toJSON());
GUILD_COMMANDS.push(new SlashCommandBuilder().setName('invite').setDescription('Invite me to your server!').toJSON());
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
    .setName('membershipscreening')
    .setDescription('Membership screening')
    .addSubcommand(enable => enable
        .setName('enable')
        .setDescription('Enable Membership screening')
    )
    .addSubcommand(enable => enable
        .setName('disable')
        .setDescription('Disable Membership screening')
    )
    .addSubcommand(setrole => setrole
        .setName('setrole')
        .setDescription('Configure role of Membership screening')
        .addRoleOption(option => option
            .setName('role')
            .setDescription('Role to give to user')
            .setRequired(true)
        )
    )
    .addSubcommand(setchannel => setchannel
        .setName('setchannel')
        .setDescription('Configure channel of Membership screening')
        .addChannelOption(option => option
            .setName('channel')
            .setDescription('Channel to send request to')
            .setRequired(true)
        )
    )
    .addSubcommand(createmessage => createmessage
        .setName('createmessage')
        .setDescription('Create message for Membership screening')
    )
);

export const registerAllGlobalCommands = async () => {
    Logger.log('info', `Registering all global interaction commands`);
    await DiscordProvider.client.application?.commands.set(JSON.parse(JSON.stringify(GLOBAL_COMMANDS)));
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
        await DiscordProvider.client.guilds.cache.get(guildObject.id)?.commands.set(JSON.parse(JSON.stringify(GUILD_COMMANDS)));
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