import { Message, Interaction, CommandInteraction, BaseInteraction } from 'discord.js';

import Users from '../services/Users';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    makeSuccessEmbed,
    makeProcessingEmbed,
    sendHybridInteractionMessageResponse
} from '../utils/DiscordMessage';
import {
    registerAllGuildsCommands,
    registerAllGlobalCommands,
    unregisterAllGuildsCommands,
    unregisterAllGlobalCommands
} from '../utils/DiscordInteraction';

const EMBEDS = {
    INTERACTION_INFO: (data: Message | BaseInteraction) => {
        return makeInfoEmbed({
            title: 'Interaction',
            description: `This module contains management tool for interaction based contents`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``reloadAll`` ``unloadAll`` ``reloadglobal``'
                }
            ],
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    PROCESSING: (data: Message | BaseInteraction) => {
        return makeProcessingEmbed({
            icon: data instanceof Message ? undefined : '⌛',
            title: `Performing actions`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    NOT_DEVELOPER: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: 'Developer only',
            description: `This command is restricted to the developers only`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    UNLOADALL_SUCCESS: (data: Message | BaseInteraction) => {
        return makeSuccessEmbed({
            title: 'Unloaded all Interaction',
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    UNLOADALL_ERROR: (data: Message | BaseInteraction, err: any) => {
        return makeErrorEmbed({
            title: 'An error occurred while trying to unload interaction',
            description: '```' + err + '```',
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    RELOADALL_SUCCESS: (data: Message | BaseInteraction) => {
        return makeSuccessEmbed({
            title: 'Reloaded all Interaction',
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    RELOADALL_ERROR: (data: Message | BaseInteraction, err: any) => {
        return makeErrorEmbed({
            title: 'An error occurred while trying to reload interaction',
            description: '```' + err + '```',
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    }
};

export default class InteractionManager extends DiscordModule {
    public id = 'Discord_InteractionManager';
    public commands = ['interaction'];
    public commandInteractionName = 'interaction';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const user = data.getUser();
        if (!user) return;

        if (!Users.isDeveloper(user.id))
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NOT_DEVELOPER(data.getRaw())]
            });

        const funct = {
            unloadAll: async (data: HybridInteractionMessage) => {
                let placeholder: HybridInteractionMessage | undefined;

                let _placeholder = await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PROCESSING(data.getRaw())]
                });
                if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

                try {
                    await unregisterAllGuildsCommands();

                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder
                            .getMessage()
                            .edit({ embeds: [EMBEDS.UNLOADALL_SUCCESS(data.getRaw())] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.UNLOADALL_SUCCESS(data.getRaw())] },
                            true
                        );
                } catch (err) {
                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder
                            .getMessage()
                            .edit({ embeds: [EMBEDS.UNLOADALL_ERROR(data.getRaw(), err)] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.UNLOADALL_ERROR(data.getRaw(), err)] },
                            true
                        );
                }
            },
            reloadGlobal: async (data: HybridInteractionMessage) => {
                let placeholder: HybridInteractionMessage | undefined;

                let _placeholder = await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PROCESSING(data.getRaw())]
                });
                if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

                try {
                    await unregisterAllGlobalCommands();
                    await registerAllGlobalCommands();

                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder
                            .getMessage()
                            .edit({ embeds: [EMBEDS.RELOADALL_SUCCESS(data.getRaw())] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.RELOADALL_SUCCESS(data.getRaw())] },
                            true
                        );
                } catch (err) {
                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder
                            .getMessage()
                            .edit({ embeds: [EMBEDS.RELOADALL_ERROR(data.getRaw(), err)] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.RELOADALL_ERROR(data.getRaw(), err)] },
                            true
                        );
                }
            },
            reloadAll: async (data: HybridInteractionMessage) => {
                let placeholder: HybridInteractionMessage | undefined;

                let _placeholder = await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PROCESSING(data.getRaw())]
                });
                if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

                try {
                    await unregisterAllGuildsCommands();
                    await registerAllGuildsCommands();

                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder
                            .getMessage()
                            .edit({ embeds: [EMBEDS.RELOADALL_SUCCESS(data.getRaw())] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.RELOADALL_SUCCESS(data.getRaw())] },
                            true
                        );
                } catch (err) {
                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder
                            .getMessage()
                            .edit({ embeds: [EMBEDS.RELOADALL_ERROR(data.getRaw(), err)] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.RELOADALL_ERROR(data.getRaw(), err)] },
                            true
                        );
                }
            }
        };

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.INTERACTION_INFO(data.getRaw())]
                });

            query = args[0].toLowerCase();
        } else if (data.isApplicationCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'info':
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.INTERACTION_INFO(data.getRaw())]
                });
            case 'reloadall':
                return await funct.reloadAll(data);
            case 'reloadglobal':
                return await funct.reloadGlobal(data);
            case 'unloadall':
                return await funct.unloadAll(data);
        }
    }
}
