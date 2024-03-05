import { SlashCommandBuilder } from '@discordjs/builders';

import DiscordProvider from '../providers/Discord';
import Logger from '../libs/Logger';

export const GLOBAL_COMMANDS: Object[] = [
    new SlashCommandBuilder().setName('help').setDescription('Show help menu'),
    new SlashCommandBuilder().setName('ping').setDescription('Measure network latency'),
    new SlashCommandBuilder().setName('invite').setDescription('Invite me to your server!'),
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Lookup discord user information')
        .addSubcommand((user) =>
            user
                .setName('user')
                .setDescription('Lookup discord user information')
                .addUserOption((user) =>
                    user.setName('user').setDescription('Discord user to lookup').setRequired(true)
                )
        ),
    new SlashCommandBuilder().setName('stats').setDescription('Show the bot stats'),

    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music')
        .addStringOption((option) => option.setName('query').setDescription('Search query or link').setRequired(true)),
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for music')
        .addStringOption((option) => option.setName('query').setDescription('Search query').setRequired(true)),
    new SlashCommandBuilder().setName('playmy').setDescription('Play the detected songs you are listening to'),
    new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
    new SlashCommandBuilder().setName('pause').setDescription('Pause the current music'),
    new SlashCommandBuilder().setName('resume').setDescription('Resume paused music'),
    new SlashCommandBuilder().setName('queue').setDescription('View the music queue'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current song information'),
    new SlashCommandBuilder().setName('join').setDescription('Join the voice channel'),
    new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel'),

    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make me say something')
        .addStringOption((option) =>
            option.setName('message').setDescription('Message you want me to say').setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Purge messages')
        .addStringOption((option) => option.setName('amount').setDescription('Amount to purge').setRequired(true)),

    new SlashCommandBuilder()
        .setName('osu')
        .setDescription('Interact with the game osu!')
        .addSubcommand((user) =>
            user
                .setName('user')
                .setDescription('Get user information on osu!')
                .addStringOption((user) => user.setName('user').setDescription('Username or User id').setRequired(true))
        )
        .addSubcommand((beatmap) =>
            beatmap
                .setName('beatmap')
                .setDescription('Get beatmap information on osu!')
                .addStringOption((user) => user.setName('beatmap').setDescription('Beatmap id').setRequired(true))
        ),

    new SlashCommandBuilder()
        .setName('vrchat')
        .setDescription('Interact with the VRChat')
        .addSubcommand((user) =>
            user
                .setName('user')
                .setDescription('Get user information on VRChat')
                .addStringOption((user) => user.setName('user').setDescription('Username or User id').setRequired(true))
        )
        .addSubcommand((world) =>
            world
                .setName('world')
                .setDescription('Get world information on VRChat')
                .addStringOption((user) => user.setName('world').setDescription('World id').setRequired(true))
        )
];
export const GUILD_COMMANDS: Object[] = [];

/*
GUILD_COMMANDS.push(
    new SlashCommandBuilder()
        .setName('interaction')
        .setDescription('[Developer Only] Manage interaction')
        .addSubcommand((info) =>
            info.setName('info').setDescription('[Developer Only] Interaction modules information')
        )
        .addSubcommand((reloadAll) =>
            reloadAll
                .setName('reloadall')
                .setDescription('[Developer Only] Reload interaction for global and all guilds')
        )
);
GUILD_COMMANDS.push(
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Change settings')
        .addSubcommand((info) =>
            info
                .setName('setprefix')
                .setDescription('Change what prefix to use on this guild')
                .addStringOption((prefix) =>
                    prefix.setName('prefix').setDescription('New prefix to use').setRequired(true)
                )
        )
        .addSubcommand((info) =>
            info
                .setName('setenableserviceannouncement')
                .setDescription('Enable or disable service announcement feature')
                .addStringOption((prefix) =>
                    prefix.setName('status').setDescription('New status').setRequired(true)
                )
        )
        .addSubcommand((info) =>
            info
                .setName('setserviceannouncementchannel')
                .setDescription('Set channel where service announcement will be sent')
                .addChannelOption((prefix) =>
                    prefix.setName('channel').setDescription('New status').setRequired(true)
                )
        )
);
GUILD_COMMANDS.push(
    new SlashCommandBuilder()
        .setName('membershipscreening')
        .setDescription('Membership screening')
        .addSubcommand((info) =>
            info.setName('info').setDescription('Show more information for membership screening')
        )
        .addSubcommand((enable) =>
            enable.setName('enable').setDescription('Enable membership screening')
        )
        .addSubcommand((enable) =>
            enable.setName('disable').setDescription('Disable membership screening')
        )
        .addSubcommand((setrole) =>
            setrole
                .setName('setrole')
                .setDescription('Set a role that user will be granted when approved to join')
                .addRoleOption((option) =>
                    option
                        .setName('role')
                        .setDescription(
                            'Select a role that user will be granted when approved to join'
                        )
                        .setRequired(true)
                )
        )
        .addSubcommand((setchannel) =>
            setchannel
                .setName('setchannel')
                .setDescription(
                    'Set channel where membership screening approval request will be sent'
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Select a channel where approval request will be sent')
                        .setRequired(true)
                )
        )
        .addSubcommand((createmessage) =>
            createmessage
                .setName('createmessage')
                .setDescription(
                    'Create greeting message for membership screening into the channel. A message for new commers to read'
                )
        )
);*/

export const registerAllGlobalCommands = async () => {
    Logger.log('info', `Registering all global interaction commands`);
    await DiscordProvider.client.application?.commands.set(JSON.parse(JSON.stringify(GLOBAL_COMMANDS)));
};

export const unregisterAllGlobalCommands = async () => {
    //const commands = await DiscordProvider.client.application?.commands.fetch();

    //if(typeof commands === 'undefined') return;
    //if(commands.size === 0) return;

    Logger.log('info', `Unregistering all global interaction commands`);
    await DiscordProvider.client.application?.commands.set([]);
    /*for(const command of commands) {
        await DiscordProvider.client.application?.commands.delete(command[1]);
    }*/
};

export const registerAllGuildsCommands = async () => {
    const guilds = DiscordProvider.client.guilds.cache.map((guild) => guild.id);

    for (const guild of guilds) {
        const guildObject = DiscordProvider.client.guilds.cache.get(guild);

        if (!guildObject) continue;

        Logger.log('info', `Registering all interaction commands on guild ${guildObject.name} (${guildObject.id})`);
        await DiscordProvider.client.guilds.cache
            .get(guildObject.id)
            ?.commands.set(JSON.parse(JSON.stringify(GUILD_COMMANDS)));
    }
};

export const unregisterAllGuildsCommands = async () => {
    const guilds = DiscordProvider.client.guilds.cache.map((guild) => guild.id);

    for (const guild of guilds) {
        const guildObject = DiscordProvider.client.guilds.cache.get(guild);

        if (!guildObject) continue;

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
};
