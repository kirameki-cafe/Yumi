import {
    Message,
    Interaction,
    CommandInteraction,
    MessageActionRow,
    MessageButton,
    ButtonInteraction
} from 'discord.js';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    sendHybridInteractionMessageResponse
} from '../../utils/DiscordMessage';

import DiscordMusicPlayer from '../../providers/DiscordMusicPlayer';
import Users from '../../services/Users';

const EMBEDS = {
    DEBUG_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Debug',
            description: `Test and debug something. **Should not be used on production**`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``invalidInteraction`` ``crashMusicPlayer`` ``crash`` ``activemusicplayer``'
                }
            ],
            user: data instanceof Interaction ? data.user : data.author
        });
    },
    INVALID_TEST: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Click button below to test invalid interaction',
            description: `The interaction will be failed`,
            user: data instanceof Interaction ? data.user : data.author
        });
    },
    CRASHING: (data: Message | Interaction) => {
        return makeInfoEmbed({
            icon: '💀',
            title: 'Crashing myself',
            description: `Sayonara.... cruel world`,
            user: data instanceof Interaction ? data.user : data.author
        });
    },
    ACTIVE_MUSIC_PLAYERS: (data: Message | Interaction, totalplayers: Map<any, any>) => {
        return makeInfoEmbed({
            icon: '🎵',
            title: `Total active music players: ${totalplayers.size}`,
            user: data instanceof Interaction ? data.user : data.author
        });
    },
    NOT_DEVELOPER: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Developer only',
            description: `This command is restricted to the developers only`,
            user: data instanceof Interaction ? data.user : data.author
        });
    }
};

export default class Debug extends DiscordModule {
    public id = 'Discord_Developer_Debug';
    public commands = ['debug', 'dbg'];
    public commandInteractionName = 'debug';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async GuildButtonInteractionCreate(data: ButtonInteraction) {
        if (data.customId !== 'dev_make_invalid_interaction') return;

        const hybridData = new HybridInteractionMessage(data);
        const user = hybridData.getUser();

        if (!user) return;

        if (!Users.isDeveloper(user.id))
            return await sendHybridInteractionMessageResponse(hybridData, {
                embeds: [EMBEDS.NOT_DEVELOPER(hybridData.getRaw())]
            });

        setTimeout(async () => {
            await sendHybridInteractionMessageResponse(hybridData, {
                content: 'dev_make_invalid_interaction'
            });
        }, 7 * 1000);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        const user = data.getUser();
        const channel = data.getChannel();

        if (!guild || !user || !channel) return;

        if (!Users.isDeveloper(user.id))
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NOT_DEVELOPER(data.getRaw())]
            });

        const funct = {
            crash: async (data: HybridInteractionMessage) => {
                await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.CRASHING(data.getRaw())]
                });
                throw new Error('Manually crashed by debug command');
            },
            crashMusicPlayer: async (data: HybridInteractionMessage) => {
                const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
                if (!instance) return;

                instance._fake_error_on_player();
            },
            activeMusicPlayer: async (data: HybridInteractionMessage) => {
                await sendHybridInteractionMessageResponse(data, {
                    embeds: [
                        EMBEDS.ACTIVE_MUSIC_PLAYERS(data.getRaw(), DiscordMusicPlayer.GuildQueue)
                    ]
                });
            },
            invalidInteraction: async (data: HybridInteractionMessage) => {
                const row = new MessageActionRow().addComponents(
                    new MessageButton()
                        .setEmoji('😥')
                        .setLabel(
                            ' Make invalid interaction (Wait 7 seconds, check error in console or logs)'
                        )
                        .setCustomId('dev_make_invalid_interaction')
                        .setStyle('PRIMARY')
                );
                await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.INVALID_TEST(data.getRaw())],
                    components: [row]
                });
            }
        };

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.DEBUG_INFO(data.getRaw())]
                });

            query = args[0].toLowerCase();
        } else if (data.isSlashCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'info':
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.DEBUG_INFO(data.getRaw())]
                });
            case 'crash':
                return await funct.crash(data);
            case 'invalidinteraction':
                return await funct.invalidInteraction(data);
            case 'crashmusicplayer':
                return await funct.crashMusicPlayer(data);
            case 'activemusicplayer':
                return await funct.activeMusicPlayer(data);
        }
    }
}
