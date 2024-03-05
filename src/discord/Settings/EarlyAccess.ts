import { Guild, GuildChannel, ThreadChannel, Message, PermissionsBitField } from 'discord.js';
import { I18n } from 'i18n';

import Prisma from '../../providers/Prisma';
import Cache from '../../providers/Cache';

import { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    makeSuccessEmbed,
    sendHybridInteractionMessageResponse,
    makeWarningEmbed
} from '../../utils/DiscordMessage';

import { COMMON_EMBEDS } from '.';
import { checkMemberPermissionsInGuild } from '../../utils/DiscordPermission';

const EMBEDS = {
    EARLY_ACCESS_INVALID_STATUS: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: 'Invalid status, Use ``true`` or ``false``',
            user: data.getUser()
        });
    },
    NO_EARLY_ACCESS_STATUS_PROVIDED: async (
        data: HybridInteractionMessage,
        locale: I18n,
        isServiceAnnouncementEnabled: boolean
    ) => {
        return makeInfoEmbed({
            title: 'Early Access Opt-in Status',
            description: `Early Access features are ${
                isServiceAnnouncementEnabled ? '**enabled**' : '**disabled**'
            } on this server`,
            user: data.getUser()
        });
    },
    EARLY_ACCESS_STATUS_UPDATED: (data: HybridInteractionMessage, locale: I18n, newStatus: boolean) => {
        return makeSuccessEmbed({
            title: `Early Access features are now ${newStatus ? 'enabled' : 'disabled'}`,
            user: data.getUser()
        });
    },
    EARLY_ACCESS_STATUS_ALREADY_SET: (data: HybridInteractionMessage, locale: I18n, status: boolean) => {
        return makeInfoEmbed({
            title: `Early Access features are already ${status ? 'enabled' : 'disabled'}`,
            user: data.getUser()
        });
    },
    EARLY_ACCESS_ENABLED_WARNING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeWarningEmbed({
            title: locale.__('early_access_warning.title'),
            description: locale.__('early_access_warning.description'),
            user: data.getUser()
        });
    }
};

export const setEnableEarlyAccess = async (data: HybridInteractionMessage, args: any, guild: Guild, locale: I18n) => {
    let member = data.getMember();
    if (!member) return;

    if (
        !(await checkMemberPermissionsInGuild({
            member,
            data,
            locale,
            permissions: [PermissionsBitField.Flags.Administrator]
        }))
    )
        return;

    let GuildCache = await Cache.getCachedGuild(guild.id);
    if (!GuildCache) return;

    let newStatus: string | null | undefined;
    if (data.isMessage()) {
        let _name: string;
        if (typeof args[1] === 'undefined')
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [await EMBEDS.NO_EARLY_ACCESS_STATUS_PROVIDED(data, locale, GuildCache.EarlyAccess_Enabled)]
            });

        let __name = args;
        __name.shift();
        _name = __name.join(' ');
        newStatus = _name;
    } else if (data.isApplicationCommand())
        newStatus = data.getSlashCommand().options.get('status', true).value?.toString();

    if (!newStatus)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [await EMBEDS.NO_EARLY_ACCESS_STATUS_PROVIDED(data, locale, GuildCache.EarlyAccess_Enabled)]
        });

    if (!['true', 'false', 'yes', 'no', 'y', 'n', 'enable', 'disable', 'on', 'off'].includes(newStatus.toLowerCase()))
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.EARLY_ACCESS_INVALID_STATUS(data, locale)]
        });

    const newStatusBool = ['true', 'yes', 'y', 'enable', 'on'].includes(newStatus.toLowerCase()) ? true : false;

    if (GuildCache?.EarlyAccess_Enabled === newStatusBool)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.EARLY_ACCESS_STATUS_ALREADY_SET(data, locale, newStatusBool)]
        });

    let placeholder = await sendHybridInteractionMessageResponse(data, {
        embeds: [COMMON_EMBEDS.PROCESSING(data, locale)]
    });

    await Prisma.client.guild.update({
        where: { id: guild.id },
        data: {
            EarlyAccess_Enabled: newStatusBool
        }
    });

    await Cache.updateGuildCache(guild.id);

    let toSend = [EMBEDS.EARLY_ACCESS_STATUS_UPDATED(data, locale, newStatusBool)];

    if (newStatusBool) toSend.push(EMBEDS.EARLY_ACCESS_ENABLED_WARNING(data, locale));

    if (data.isMessage())
        return await (placeholder as Message).edit({
            embeds: toSend
        });
    else if (data.isApplicationCommand())
        return await sendHybridInteractionMessageResponse(
            data,
            {
                embeds: toSend
            },
            true
        );
};
