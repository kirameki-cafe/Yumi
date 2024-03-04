import {
    Message,
    CommandInteraction,
    PermissionsBitField,
    GuildBasedChannel,
    BaseGuildTextChannel,
    BaseInteraction
} from 'discord.js';
import { I18n } from 'i18n';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import {
    makeSuccessEmbed,
    sendHybridInteractionMessageResponse,
    makeErrorEmbed,
    makeInfoEmbed,
    sendMessage
} from '../utils/DiscordMessage';
import Locale from '../services/Locale';
import Logger from '../libs/Logger';
import Prisma from '../providers/Prisma';
import Environment from '../providers/Environment';

const EMBEDS = {
    PURGE_INFO: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('purge.title'),
            description: locale.__('purge.info'),
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('purge.valid_args')
                }
            ],
            user: data.getUser()
        });
    },
    NO_PERMISSION: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('common.no_permissions'),
            description: locale.__('common.no_permissions_description', {
                PERMISSIONS: 'VIEW_CHANNEL, MANAGE_MESSAGES'
            }),
            user: data.getUser()
        });
    },
    PURGING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('purge.title'),
            description: locale.__('purge.purging'),
            user: data.getUser()
        });
    },
    PURGE_ERROR: (data: HybridInteractionMessage, locale: I18n, error: Error) => {
        return makeErrorEmbed({
            title: locale.__('purge.error'),
            description: error.message ? error.message : undefined,
            user: data.getUser()
        });
    },
    PURGE_NAN_ERROR: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('purge.error'),
            description: locale.__('purge.error_nan'),
            user: data.getUser()
        });
    },
    PURGE_OVER_LIMIT: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('purge.error'),
            description: locale.__('purge.error_over_limit'),
            user: data.getUser()
        });
    },
    SUCCESSFULLY_PURGED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('purge.success'),
            user: data.getUser()
        });
    }
};

export default class Purge extends DiscordModule {
    public id = 'Discord_Purge';
    public commands = ['purge'];
    public commandInteractionName = 'purge';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        // Disable this unfinished feature in production
        if (Environment.get().NODE_ENV !== 'production') return;

        const guild = data.getGuild();
        if (!guild) return;

        const locale = await Locale.getGuildLocale(guild.id);

        let query;

        const channel = data.getChannel();
        if (!channel) return;

        if (data.isMessage()) {
            const message = data.getMessage();

            if (!message.member) return;

            if (
                !message.member.permissions.has([
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.ManageMessages
                ])
            )
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_PERMISSION(data, locale)]
                });

            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PURGE_INFO(data, locale)]
                });

            query = args.join(' ');
        } else if (data.isApplicationCommand()) {
            const interaction = data.getSlashCommand();
            if (
                !data
                    .getGuild()!
                    .members.cache.get(interaction.user.id)
                    ?.permissions.has([PermissionsBitField.Flags.ViewChannel]) &&
                data
                    .getGuild()!
                    .members.cache.get(interaction.user.id)
                    ?.permissions.has([PermissionsBitField.Flags.ManageMessages])
            )
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_PERMISSION(data, locale)]
                });

            query = interaction.options.get('message', true).value?.toString();
        }

        const purgeMessages = async (query: any, data: HybridInteractionMessage) => {
            if (isNaN(query)) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PURGE_NAN_ERROR(data, locale)]
                });
            }

            const PrismaGuild = await Prisma.client.guild.findFirst({ where: { id: guild.id } });
            if (!PrismaGuild) return;

            const guildLimit = PrismaGuild.Purge_Limit;
            try {
                let totalMessagesToDelete = parseInt(query);

                // if (totalMessagesToDelete > guildLimit) {
                //     return await sendHybridInteractionMessageResponse(data, {
                //         embeds: [EMBEDS.PURGE_OVER_LIMIT(data, locale)]
                //     });
                // }

                let amountToDelete = totalMessagesToDelete > 100 ? 100 : totalMessagesToDelete;
                let messages;
                let statusMessage;
                if (data.isMessage()) {
                    if (data.getMessage().deletable)
                        await data
                            .getMessage()
                            .delete()
                            .catch(() => {});

                    statusMessage = await sendMessage(channel, data.getUser()!, {
                        embeds: [EMBEDS.PURGING(data, locale)]
                    });
                } else if (data.isApplicationCommand()) {
                    statusMessage = await data
                        .getMessageComponentInteraction()
                        .reply({ embeds: [EMBEDS.PURGING(data, locale)], fetchReply: true });
                    statusMessage = statusMessage as unknown as BaseInteraction;
                }

                statusMessage = new HybridInteractionMessage(statusMessage!);

                messages = await channel.messages.fetch({
                    limit: amountToDelete,
                    before: statusMessage!.getMessage().id
                });

                // Filter out statusMessage
                // messages = messages.filter((msg) => msg.id !== statusMessage!.getMessage().id);

                // Filter out message sent after the status message
                // messages = messages.filter(
                //    (msg) => msg.createdTimestamp < statusMessage!.getMessage().createdTimestamp
                //);

                //TODO: Handle no messages to delete
                if (!messages) {
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.SUCCESSFULLY_PURGED(data, locale)]
                    });
                }

                const deletedMessages = await (channel as BaseGuildTextChannel).bulkDelete(messages, true);
                let messageSize = deletedMessages.size;

                Logger.debug(
                    '[DiscordPurge]',
                    `Bulk deleted ${messageSize} messages. Total deleted: ${messageSize}/${totalMessagesToDelete}`
                );

                if (messageSize !== totalMessagesToDelete) {
                    const remainingMessages = totalMessagesToDelete - messageSize;
                    const fetchLimit = 100;
                    const fetchIterations = Math.ceil(remainingMessages / fetchLimit);

                    for (let i = 0; i < fetchIterations; i++) {
                        const fetchAmount = Math.min(fetchLimit, remainingMessages - i * fetchLimit);
                        let fetchedMessages = await channel.messages.fetch({
                            limit: fetchAmount,
                            before: statusMessage!.getMessage().id
                        });

                        fetchedMessages = fetchedMessages.filter((msg) => msg.id !== statusMessage!.getMessage().id);

                        for (const msg of fetchedMessages.values()) {
                            await msg.delete();
                            messageSize += 1;
                            Logger.debug('[DiscordPurge]', `Total deleted: ${messageSize}/${totalMessagesToDelete}`);

                            // One second delay to prevent rate limit
                            await new Promise((resolve) => setTimeout(resolve, 2000));
                        }
                    }
                }

                Logger.debug('[DiscordPurge]', `Total deleted: ${messageSize}/${totalMessagesToDelete}`);

                if (data.isMessage()) {
                    return await sendMessage(channel, data.getUser()!, {
                        embeds: [EMBEDS.SUCCESSFULLY_PURGED(data, locale)]
                    });
                } else if (data.isApplicationCommand()) {
                    return await data
                        .getMessageComponentInteraction()
                        .editReply({ embeds: [EMBEDS.SUCCESSFULLY_PURGED(data, locale)] });
                }
            } catch (err: any) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PURGE_ERROR(data, locale, err)]
                });
            }
        };

        if (data.isApplicationCommand() && data.getChannel()) {
            await purgeMessages(query, data);
        } else if (data.isMessage()) {
            await purgeMessages(query, data);
        }
    }
}
