import {
    Message,
    CommandInteraction,
    PermissionsBitField,
    GuildBasedChannel,
    BaseGuildTextChannel,
    BaseInteraction,
    GuildTextBasedChannel
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
import {
    checkBotPermissionsInChannel,
    checkMemberPermissionsInChannel,
    checkMemberPermissionsInGuild
} from '../utils/DiscordPermission';
import Cache from '../providers/Cache';
import { COMMON_EMBEDS } from './Settings';

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
    PURGING_STAGE_1: (data: HybridInteractionMessage, locale: I18n, current: number, total: number) => {
        return makeInfoEmbed({
            title: locale.__('purge.title'),
            description:
                locale.__('purge.purging_progress', { CURRENT: current.toString(), TOTAL: total.toString() }) +
                '\n\n' +
                locale.__('purge.purging_step_bulk_delete_done', { COUNT: current.toString() }),
            user: data.getUser()
        });
    },
    PURGING_STAGE_2: (
        data: HybridInteractionMessage,
        locale: I18n,
        current: number,
        current_normal: number,
        total: number
    ) => {
        return makeInfoEmbed({
            title: locale.__('purge.title'),
            description:
                locale.__('purge.purging_progress', {
                    CURRENT: (current + current_normal).toString(),
                    TOTAL: total.toString()
                }) +
                '\n\n' +
                locale.__('purge.purging_step_bulk_delete_done', { COUNT: current.toString() }) +
                '\n' +
                locale.__('purge.purging_step_normal_delete', { CURRENT: current_normal.toString() }),
            user: data.getUser()
        });
    },
    PURGING_DONE_EARLY: (data: HybridInteractionMessage, locale: I18n, current: number, total: number) => {
        return makeSuccessEmbed({
            title: locale.__('purge.title'),
            description:
                locale.__('purge.purge_progress', { COUNT: current.toString(), TOTAL: total.toString() }) +
                '\n\n' +
                locale.__('purge.purging_step_bulk_delete_done', { COUNT: current.toString() }),
            user: data.getUser()
        });
    },
    PURGING_DONE: (
        data: HybridInteractionMessage,
        locale: I18n,
        current: number,
        current_normal: number,
        total: number
    ) => {
        return makeSuccessEmbed({
            title: locale.__('purge.title'),
            description:
                locale.__('purge.purge_progress', {
                    COUNT: (current + current_normal).toString(),
                    TOTAL: total.toString()
                }) +
                '\n\n' +
                locale.__('purge.purging_step_bulk_delete_done', { COUNT: current.toString() }) +
                '\n' +
                locale.__('purge.purging_step_normal_delete_done', { COUNT: current_normal.toString() }),
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
            title: locale.__('purge.nan_error_title'),
            description: locale.__('purge.nan_error_description'),
            user: data.getUser()
        });
    },
    PURGE_OVER_LIMIT: (data: HybridInteractionMessage, locale: I18n, limit: number) => {
        return makeErrorEmbed({
            title: locale.__('common.member_no_permissions'),
            description: locale.__('purge.error_over_limit', { MAX: limit.toString() }),
            user: data.getUser()
        });
    },
    NOTHING_PURGED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('purge.nothing_purged'),
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
        const guild = data.getGuild();
        if (!guild) return;

        const member = data.getMember();
        if (!member) return;

        const channel = data.getGuildChannel() as GuildTextBasedChannel;
        if (!channel) return;

        const cachedGuild = await Cache.getCachedGuild(guild.id);
        if (!cachedGuild) return;

        const locale = await Locale.getGuildLocale(guild.id);

        // TODO: Remove this feature when ready from early access
        if (!cachedGuild.EarlyAccess_Enabled)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [COMMON_EMBEDS.EARLY_ACCESS_WARNING(data, locale)]
            });

        let query;

        if (data.isMessage()) {
            const message = data.getMessage();

            if (!message.member) return;

            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PURGE_INFO(data, locale)]
                });

            query = args.join(' ');
        } else if (data.isApplicationCommand()) {
            const interaction = data.getSlashCommand();
            query = interaction.options.get('amount', true).value?.toString();
        }

        const purgeMessages = async (query: any, data: HybridInteractionMessage) => {
            if (isNaN(query)) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.PURGE_NAN_ERROR(data, locale)]
                });
            }

            if (
                !(await checkMemberPermissionsInChannel({
                    member,
                    channel,
                    data,
                    locale,
                    permissions: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageMessages]
                }))
            )
                return;

            if (
                !(await checkBotPermissionsInChannel({
                    guild,
                    data,
                    locale,
                    channel,
                    permissions: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageMessages]
                }))
            )
                return;

            const PrismaGuild = await Prisma.client.guild.findFirst({ where: { id: guild.id } });
            if (!PrismaGuild) return;

            const guildLimit = PrismaGuild.Purge_Limit;
            try {
                let totalMessagesToDelete = parseInt(query);

                if (totalMessagesToDelete > guildLimit) {
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.PURGE_OVER_LIMIT(data, locale, guildLimit)]
                    });
                }

                let totalMessageDeleted = 0;
                let totalBulkDeletedMessages = 0;

                let messages;
                let statusMessage;
                if (data.isMessage()) {
                    if (data.getMessage().deletable)
                        await data
                            .getMessage()
                            .delete()
                            .catch(() => {});

                    statusMessage = await sendMessage(channel, data.getUser()!, {
                        embeds: [EMBEDS.PURGING_STAGE_1(data, locale, totalBulkDeletedMessages, totalMessagesToDelete)]
                    });
                } else if (data.isApplicationCommand()) {
                    statusMessage = await data.getMessageComponentInteraction().reply({
                        embeds: [EMBEDS.PURGING_STAGE_1(data, locale, totalBulkDeletedMessages, totalMessagesToDelete)],
                        fetchReply: true
                    });
                    statusMessage = statusMessage as unknown as BaseInteraction;
                }

                statusMessage = new HybridInteractionMessage(statusMessage!);

                let amountToDelete = totalMessagesToDelete > 100 ? 100 : totalMessagesToDelete;
                messages = await channel.messages.fetch({
                    limit: amountToDelete,
                    before: statusMessage.getMessage().id
                });

                // Filter out statusMessage
                // messages = messages.filter((msg) => msg.id !== statusMessage!.getMessage().id);

                // Filter out message sent after the status message
                // messages = messages.filter(
                //    (msg) => msg.createdTimestamp < statusMessage!.getMessage().createdTimestamp
                //);

                // Edit the message
                if (messages.size === 0) {
                    let embed = EMBEDS.NOTHING_PURGED(data, locale);
                    if (data.isMessage()) {
                        return await statusMessage.getMessage().edit({ embeds: [embed] });
                    } else if (data.isApplicationCommand()) {
                        return await statusMessage.getMessageComponentInteraction().editReply({ embeds: [embed] });
                    }
                }

                while (totalMessageDeleted < totalMessagesToDelete) {
                    amountToDelete =
                        totalMessagesToDelete - totalMessageDeleted > 100
                            ? 100
                            : totalMessagesToDelete - totalMessageDeleted;

                    Logger.debug(
                        '[DiscordPurge]',
                        `Attempting to delete ${amountToDelete} messages. Total deleted: ${totalBulkDeletedMessages}/${totalMessagesToDelete}`
                    );

                    messages = await channel.messages.fetch({
                        limit: amountToDelete,
                        before: statusMessage.getMessage().id
                    });

                    messages = messages.filter((msg) => msg.deletable);

                    if (messages.size === 0) {
                        let embed = EMBEDS.PURGING_DONE_EARLY(data, locale, totalBulkDeletedMessages, amountToDelete);
                        if (data.isMessage()) {
                            return await statusMessage.getMessage().edit({ embeds: [embed] });
                        } else if (data.isApplicationCommand()) {
                            return await statusMessage.getMessageComponentInteraction().editReply({ embeds: [embed] });
                        }
                    }

                    Logger.debug(
                        '[DiscordPurge]',
                        `Bulk deleting: ${messages.size}. Total deleted: ${totalBulkDeletedMessages}/${totalMessagesToDelete}`
                    );

                    const deletedMessages = await (channel as BaseGuildTextChannel).bulkDelete(messages, true);
                    totalMessageDeleted += deletedMessages.size;
                    totalBulkDeletedMessages += deletedMessages.size;

                    let embed = EMBEDS.PURGING_STAGE_1(data, locale, totalBulkDeletedMessages, totalMessagesToDelete);

                    if (data.isMessage()) {
                        await statusMessage.getMessage().edit({ embeds: [embed] });
                    } else if (data.isApplicationCommand()) {
                        await statusMessage.getMessageComponentInteraction().editReply({ embeds: [embed] });
                    }

                    // Unable to delete all the messages? Break the loop and start normal deletion
                    if (deletedMessages.size !== messages.size) break;
                }

                //let embed = EMBEDS.PURGING_DONE_EARLY(data, locale, totalBulkDeletedMessages, amountToDelete);
                Logger.debug(
                    '[DiscordPurge]',
                    `Bulk deleted ${totalBulkDeletedMessages} messages. Total deleted: ${totalBulkDeletedMessages}/${totalMessagesToDelete}`
                );

                if (totalMessageDeleted !== totalMessagesToDelete) {
                    const remainingMessages = totalMessagesToDelete - totalMessageDeleted;
                    const fetchLimit = 100;
                    const fetchIterations = Math.ceil(remainingMessages / fetchLimit);

                    for (let i = 0; i < fetchIterations; i++) {
                        const fetchAmount = Math.min(fetchLimit, remainingMessages - i * fetchLimit);
                        let fetchedMessages = await channel.messages.fetch({
                            limit: fetchAmount,
                            before: statusMessage!.getMessage().id
                        });

                        fetchedMessages = fetchedMessages.filter((msg) => msg.id !== statusMessage!.getMessage().id);
                        fetchedMessages = fetchedMessages.filter((msg) => msg.deletable);

                        let messageCounter = 0; // Counter for tracking every 5 messages

                        for (const msg of fetchedMessages.values()) {
                            await msg.delete().catch(() => {});
                            totalMessageDeleted += 1;
                            messageCounter += 1;

                            if (messageCounter === 1 || messageCounter % 5 === 0) {
                                let embed = EMBEDS.PURGING_STAGE_2(
                                    data,
                                    locale,
                                    totalBulkDeletedMessages,
                                    totalMessageDeleted,
                                    totalMessagesToDelete
                                );

                                if (data.isMessage()) {
                                    await statusMessage.getMessage().edit({ embeds: [embed] });
                                } else if (data.isApplicationCommand()) {
                                    await statusMessage.getMessageComponentInteraction().editReply({ embeds: [embed] });
                                }

                                Logger.debug(
                                    '[DiscordPurge]',
                                    `Total deleted: ${totalMessageDeleted}/${totalMessagesToDelete}`
                                );
                            }

                            // One second delay to prevent rate limit
                            await new Promise((resolve) => setTimeout(resolve, 2000));
                        }
                    }

                    Logger.debug('[DiscordPurge]', `Total deleted: ${totalMessageDeleted}/${totalMessagesToDelete}`);

                    let embed = EMBEDS.PURGING_DONE(
                        data,
                        locale,
                        totalBulkDeletedMessages,
                        totalMessageDeleted - totalBulkDeletedMessages,
                        amountToDelete
                    );
                    if (data.isMessage()) {
                        return await statusMessage.getMessage().edit({ embeds: [embed] });
                    } else if (data.isApplicationCommand()) {
                        return await statusMessage.getMessageComponentInteraction().editReply({ embeds: [embed] });
                    }
                } else {
                    Logger.debug('[DiscordPurge]', `Total deleted: ${totalMessageDeleted}/${totalMessagesToDelete}`);

                    let embed = EMBEDS.PURGING_DONE_EARLY(data, locale, totalBulkDeletedMessages, amountToDelete);
                    if (data.isMessage()) {
                        return await statusMessage.getMessage().edit({ embeds: [embed] });
                    } else if (data.isApplicationCommand()) {
                        return await statusMessage.getMessageComponentInteraction().editReply({ embeds: [embed] });
                    }
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
