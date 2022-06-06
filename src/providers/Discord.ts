import { Guild, Client, GuildMember, Intents, Interaction, Message, TextChannel } from 'discord.js';

import Logger from '../libs/Logger';
import Environment from './Environment';

import Discord_Core from '../discord/Core';
import Discord_Settings from '../discord/Settings';
import Discord_Ping from '../discord/Ping';
import Discord_Help from '../discord/Help';
import Discord_Invite from '../discord/Invite';
import Discord_Say from '../discord/Say';
import Discord_InteractionManager from '../discord/InteractionManager';
import Discord_MembershipScreening from '../discord/MembershipScreening';
import Discord_osu from '../discord/osu';
import Discord_UserInfo from '../discord/UserInfo';
import Discord_Stats from '../discord/Stats';

import Discord_MusicPlayer_Play from '../discord/MusicPlayer/Play';
import Discord_MusicPlayer_Skip from '../discord/MusicPlayer/Skip';
import Discord_MusicPlayer_Join from '../discord/MusicPlayer/Join';
import Discord_MusicPlayer_Leave from '../discord/MusicPlayer/Leave';
import Discord_MusicPlayer_Queue from '../discord/MusicPlayer/Queue';
import Discord_MusicPlayer_Search from '../discord/MusicPlayer/Search';
import Discord_MusicPlayer_NowPlaying from '../discord/MusicPlayer/NowPlaying';
import Discord_MusicPlayer_Loop from '../discord/MusicPlayer/Loop';
import Discord_MusicPlayer_Pause from '../discord/MusicPlayer/Pause';
import Discord_MusicPlayer_Resume from '../discord/MusicPlayer/Resume';

import Discord_Developer_ServiceAnnouncement from '../discord/developer/ServiceAnnouncement';
import Discord_Developer_Debug from '../discord/developer/Debug';

import Cache from './Cache';
import DiscordModule from '../utils/DiscordModule';
import { Map } from 'typescript';

class Discord {
    public client: Client;
    private loaded_module = new Map<string, DiscordModule>();

    constructor() {
        this.client = new Client({
            //partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_MEMBERS,
                Intents.FLAGS.GUILD_PRESENCES,
                Intents.FLAGS.GUILD_VOICE_STATES
            ]
        });
    }

    public init(): void {
        Logger.info('Logging in to discord');
        this.client.login(Environment.get().DISCORD_TOKEN);

        const modules: DiscordModule[] = [
            new Discord_Core(),
            new Discord_Help(),
            new Discord_Invite(),
            new Discord_Ping(),
            new Discord_Stats(),
            new Discord_UserInfo(),
            new Discord_Say(),
            new Discord_InteractionManager(),
            new Discord_osu(),
            new Discord_Settings(),

            new Discord_MusicPlayer_Play(),
            new Discord_MusicPlayer_NowPlaying(),
            new Discord_MusicPlayer_Skip(),
            new Discord_MusicPlayer_Join(),
            new Discord_MusicPlayer_Leave(),
            new Discord_MusicPlayer_Queue(),
            new Discord_MusicPlayer_Search(),
            new Discord_MusicPlayer_Loop(),
            new Discord_MusicPlayer_Pause(),
            new Discord_MusicPlayer_Resume(),

            new Discord_MembershipScreening(),

            new Discord_Developer_ServiceAnnouncement(),
            new Discord_Developer_Debug()
        ];

        for (const _module of modules) {
            if (_module.id) {
                if (this.loaded_module.has(_module.id))
                    Logger.error(
                        `Module ${
                            _module.constructor.name
                        } is trying to assign a conflicting module id ${_module.id}. ${
                            this.loaded_module.get(_module.id)!.constructor.name
                        } is already assigned to this id.`
                    );
                else this.loaded_module.set(_module.id, _module);
            } else
                Logger.error(
                    `Invalid module ${_module.constructor.name}. The module does not have an id.`
                );
        }

        Logger.info(`Loaded ${this.loaded_module.size} Discord Modules`);

        for (const module of this.loaded_module) {
            let thisModule: DiscordModule = module[1];
            thisModule.Init();
        }

        // On bot logged in
        this.client.on('ready', () => {
            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];
                thisModule.Ready();
            }
        });

        // Member join guild event to modules
        this.client.on('guildMemberAdd', (member: GuildMember) => {
            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];
                thisModule.GuildMemberAdd(member);
            }
        });

        // Interaction create event to modules
        this.client.on('interactionCreate', (interaction: Interaction) => {
            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];

                if (interaction.guild) {
                    thisModule.GuildInteractionCreate(interaction);

                    if (
                        interaction.isCommand() &&
                        interaction.commandName &&
                        thisModule.commandInteractionName
                    ) {
                        thisModule.GuildCommandInteractionCreate(interaction);
                        if (
                            interaction.commandName.toLowerCase() ===
                            thisModule.commandInteractionName
                        )
                            thisModule.GuildModuleCommandInteractionCreate(interaction);
                    } else if (interaction.isButton()) {
                        thisModule.GuildButtonInteractionCreate(interaction);
                    } else if (interaction.isSelectMenu()) {
                        thisModule.GuildSelectMenuInteractionCreate(interaction);
                    }
                }

                //thisModule.InteractionCreate(interaction);
            }
        });

        // Message create event to modules
        this.client.on('messageCreate', (message: Message) => {
            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];
                thisModule.GuildMessageCreate(message);
            }
        });

        // Joined guild event to modules
        this.client.on('guildCreate', (guild: Guild) => {
            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];
                thisModule.GuildCreate(guild);
            }
        });

        // Handling guild commands
        this.client.on('messageCreate', async (message: Message) => {
            if (!(message.channel instanceof TextChannel)) return;
            if (message.author.bot) return;
            if (typeof message.guild?.id === 'undefined') return;

            let GuildCache = await Cache.getGuild(message.guild.id);
            if (typeof GuildCache === 'undefined' || typeof GuildCache.prefix === 'undefined')
                return;

            if (!message.content.startsWith(GuildCache.prefix)) return;

            let noPrefixMessage = message.content.replace(GuildCache.prefix, '');
            let symbols = [
                '!',
                '@',
                '#',
                '$',
                '%',
                '^',
                '&',
                '*',
                '(',
                ')',
                '-',
                '=',
                '_',
                '+',
                '\\',
                '/',
                '<',
                '>',
                '[',
                ']',
                '{',
                '}',
                '`',
                '"',
                "'",
                ',',
                '.',
                '~',
                '|',
                ';',
                ':',
                '?',
                '、',
                '。'
            ];

            const isTag = (prefix: string) => {
                return (
                    (prefix.startsWith('<@!') && prefix.endsWith('>')) ||
                    (prefix.startsWith('<:') && prefix.endsWith('>')) ||
                    (prefix.startsWith('<a:') && prefix.endsWith('>')) ||
                    (prefix.startsWith('<#') && prefix.endsWith('>'))
                );
            };

            if (GuildCache.prefix.indexOf(' ') >= 0) {
                if (noPrefixMessage.charAt(0) !== ' ') return;
            } else {
                if (symbols.includes(GuildCache.prefix.charAt(GuildCache.prefix.length - 1))) {
                    if (noPrefixMessage.charAt(0) === ' ') {
                        //Handle for "@Bot <command>"
                        if (isTag(GuildCache.prefix)) {
                        } else return;
                    } else {
                        //Handle for "@Bot<command>"
                        if (isTag(GuildCache.prefix)) return;
                    }
                } else {
                    if (noPrefixMessage.charAt(0) !== ' ') return;
                }
                //if(noPrefixMessage.charAt(0) !== ' ' && !symbols.includes(noPrefixMessage.charAt(0))) return;
            }

            if (noPrefixMessage === '') return;
            if (noPrefixMessage.charAt(0) === ' ') {
                /*if(symbols.includes(GuildCache.prefix.charAt(GuildCache.prefix.length - 1))) {
                    if((GuildCache.prefix.indexOf(' ') >= 0)) return;
                }*/

                noPrefixMessage = noPrefixMessage.substring(1);
            }

            let args = noPrefixMessage.split(' ');
            args = args.filter((e) => e !== '');

            let command = args[0];

            args.shift();

            if (args.length === 0) args = [];

            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];
                thisModule.GuildOnCommand(command, args, message);

                if (thisModule.commands && thisModule.commands.includes(command))
                    thisModule.GuildOnModuleCommand(args, message);
            }
        });

        // Handling mentions
        this.client.on('messageCreate', async (message: Message) => {
            // TODO: Handle DMs commands soon
            if (!(message.channel instanceof TextChannel)) return;
            if (message.author.bot) return;

            if (typeof message.guild?.id === 'undefined') return;
            if (!message.mentions.users) return;

            if (message.mentions.users.first()?.id !== this.client.user?.id) return;
            if (!message.content.startsWith(`<@!${this.client.user?.id}>`)) return;

            let args = message.content.split(' ');
            let command = args[1];

            args.shift();
            args.shift();
            args = args.filter((e) => e !== '');

            if (args.length === 0) args = [];

            for (const module of this.loaded_module) {
                let thisModule: DiscordModule = module[1];
                thisModule.GuildOnCommand(command, args, message);

                if (thisModule.commands && thisModule.commands.includes(command))
                    thisModule.GuildOnModuleCommand(args, message);
            }
        });
    }
}

export default new Discord();
