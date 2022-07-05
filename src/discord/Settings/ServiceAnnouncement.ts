import { Guild, GuildChannel, ThreadChannel, Message, PermissionsBitField } from 'discord.js';
import { I18n } from 'i18n';

import Prisma from '../../providers/Prisma';
import Cache from '../../providers/Cache';

import { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    makeSuccessEmbed,
    sendHybridInteractionMessageResponse
} from '../../utils/DiscordMessage';

import { COMMON_EMBEDS } from '.';
import { checkMemberPermissions } from '../../utils/DiscordPermission';

const EMBEDS = {
    SERVICE_ANNOUNCEMENT_INVALID_STATUS: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: 'Invalid status, Use ``true`` or ``false``',
            user: data.getUser()
        });
    },
    NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED: async (
        data: HybridInteractionMessage,
        locale: I18n,
        isServiceAnnouncementEnabled: boolean
    ) => {
        return makeInfoEmbed({
            title: 'Service Announcement',
            description: `Service Announcement is ${
                isServiceAnnouncementEnabled ? '**enabled**' : '**disabled**'
            } on this server`,
            user: data.getUser()
        });
    },
    SERVICE_ANNOUNCEMENT_STATUS_UPDATED: (data: HybridInteractionMessage, locale: I18n, newStatus: boolean) => {
        return makeSuccessEmbed({
            title: `Service Announcement is now ${newStatus ? 'enabled' : 'disabled'}`,
            user: data.getUser()
        });
    },
    SERVICE_ANNOUNCEMENT_STATUS_ALREADY_SET: (data: HybridInteractionMessage, locale: I18n, status: boolean) => {
        return makeInfoEmbed({
            title: `Service Announcement is already ${status ? 'enabled' : 'disabled'}`,
            user: data.getUser()
        });
    },
    SERVICE_ANNOUNCEMENT_NO_PARAMETER: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: 'Missing parameter',
            description: `You must define service announcement channel to enable this feature`,
            user: data.getUser()
        });
    },
    NO_CHANNEL_MENTIONED: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: 'No channel mentioned',
            user: data.getUser()
        });
    },
    NO_CHANNEL_FOUND: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: 'Cannot find that channel',
            user: data.getUser()
        });
    },
    INVALID_CHANNEL: (data: HybridInteractionMessage, locale: I18n, channel: GuildChannel) => {
        return makeErrorEmbed({
            title: 'Invalid channel type, only TextChannel is supported',
            description: '``' + channel.name + '``' + ' is not a text channel',
            user: data.getUser()
        });
    },
    INVALID_CHANNEL_THREAD: (data: HybridInteractionMessage, locale: I18n, channel: GuildChannel | ThreadChannel) => {
        return makeErrorEmbed({
            title: 'Thread channel is not supported',
            description: '``' + channel.name + '``' + ' is a thread channel. Please use a regular text channel',
            user: data.getUser()
        });
    },
    BOT_NO_PERMISSION: (data: HybridInteractionMessage, locale: I18n, channel: GuildChannel) => {
        return makeErrorEmbed({
            title: `I don't have permission`,
            description: 'I cannot access/send message in ' + '``' + channel.name + '``',
            user: data.getUser()
        });
    },
    SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL: (data: HybridInteractionMessage, locale: I18n, channel: GuildChannel) => {
        return makeSuccessEmbed({
            title: 'Configured Service Announcement Channel',
            user: data.getUser()
        });
    }
};

export const setEnableServiceAnnouncement = async (
    data: HybridInteractionMessage,
    args: any,
    guild: Guild,
    locale: I18n
) => {
    let member = data.getMember();
    if (!member) return;

    if (!(await checkMemberPermissions({ member, data, locale, permissions: [PermissionsBitField.Flags.Administrator] })))
        return;

    let GuildCache = await Cache.getCachedGuild(guild.id);
    if(!GuildCache) return;

    let newStatus: string | null | undefined;
    if (data.isMessage()) {
        let _name: string;
        if (typeof args[1] === 'undefined')
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [await EMBEDS.NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED(data, locale, GuildCache.ServiceAnnouncement_Enabled)]
            });

        let __name = args;
        __name.shift();
        _name = __name.join(' ');
        newStatus = _name;
    } else if (data.isApplicationCommand()) newStatus = data.getSlashCommand().options.get('status', true).value?.toString();

    if (!newStatus)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [await EMBEDS.NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED(data, locale, GuildCache.ServiceAnnouncement_Enabled)]
        });

    if (!['true', 'false', 'yes', 'no', 'y', 'n', 'enable', 'disable'].includes(newStatus.toLowerCase()))
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_INVALID_STATUS(data, locale)]
        });

    const newStatusBool = ['true', 'yes', 'y', 'enable'].includes(newStatus.toLowerCase()) ? true : false;

    if (GuildCache?.ServiceAnnouncement_Enabled === newStatusBool)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_ALREADY_SET(data, locale, newStatusBool)]
        });

    if (GuildCache?.ServiceAnnouncement_Channel === null)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_NO_PARAMETER(data, locale)]
        });

    let placeholder = await sendHybridInteractionMessageResponse(data, {
        embeds: [COMMON_EMBEDS.PROCESSING(data, locale)]
    });

    await Prisma.client.guild.update({
        where: { id: guild.id },
        data: {
            ServiceAnnouncement_Enabled: newStatusBool
        }
    });

    await Cache.updateGuildCache(guild.id);

    if (data.isMessage())
        return await (placeholder as Message).edit({
            embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_UPDATED(data, locale, newStatusBool)]
        });
    else if (data.isApplicationCommand())
        return await sendHybridInteractionMessageResponse(
            data,
            {
                embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_UPDATED(data, locale, newStatusBool)]
            },
            true
        );
};

export const setServiceAnnouncementChannel = async (
    data: HybridInteractionMessage,
    args: any,
    guild: Guild,
    locale: I18n
) => {
    let member = data.getMember();
    if (!member) return;

    if (!(await checkMemberPermissions({ member, data, locale, permissions: [PermissionsBitField.Flags.Administrator] })))
        return;

    let channel;
    if (data.isMessage()) {
        if (typeof args[1] === 'undefined')
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_CHANNEL_MENTIONED(data, locale)]
            });
        channel = data.getMessage().mentions.channels.first();
    } else if (data.isApplicationCommand()) channel = data.getSlashCommand().options.get('channel', true).channel;

    if (!channel)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.NO_CHANNEL_FOUND(data, locale)]
        });

    let TargetChannel = guild.channels.cache.get(channel.id);
    if (typeof TargetChannel === 'undefined') return;

    if (TargetChannel instanceof ThreadChannel || TargetChannel.isThread())
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.INVALID_CHANNEL_THREAD(data, locale, TargetChannel)]
        });

    if (!TargetChannel.isTextBased())
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.INVALID_CHANNEL(data, locale, TargetChannel)]
        });

    if (
        !data.getGuild()?.members.me?.permissionsIn(TargetChannel)
            .has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
    )
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.BOT_NO_PERMISSION(data, locale, TargetChannel)]
        });

    let placeholder = await sendHybridInteractionMessageResponse(data, {
        embeds: [COMMON_EMBEDS.PROCESSING(data, locale)]
    });

    await Prisma.client.guild.update({
        where: { id: guild.id },
        data: { ServiceAnnouncement_Channel: channel.id }
    });

    if (data.isMessage())
        return await (placeholder as Message).edit({
            embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL(data, locale, TargetChannel)]
        });
    else if (data.isApplicationCommand())
        return await sendHybridInteractionMessageResponse(
            data,
            {
                embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL(data, locale, TargetChannel)]
            },
            true
        );
};
