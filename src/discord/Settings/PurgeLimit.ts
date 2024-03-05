import { Guild, PermissionsBitField } from 'discord.js';
import { I18n } from 'i18n';

import DiscordProvider from '../../providers/Discord';
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
import { checkMemberPermissionsInGuild } from '../../utils/DiscordPermission';

const MAX_GLOBAL_PURGE_LIMIT = 1000;

const EMBEDS = {
    PURGE_INFO: (data: HybridInteractionMessage, locale: I18n, currentLimit: string) => {
        return makeInfoEmbed({
            title: locale.__('settings_purge_limit.info', { LIMIT: currentLimit }),
            description: locale.__('settings_purge_limit.info_description'),
            user: data.getUser()
        });
    },
    PURGE_TOO_BIG: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('settings_purge_limit.purge_limit_too_big', { LIMIT: MAX_GLOBAL_PURGE_LIMIT.toString() }),
            user: data.getUser()
        });
    },
    PURGE_NAN: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('settings_purge_limit.purge_limit_nan'),
            user: data.getUser()
        });
    },
    PURGE_ZERO: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('settings_purge_limit.purge_limit_zero'),
            user: data.getUser()
        });
    },
    PURGE_UPDATED: (data: HybridInteractionMessage, locale: I18n, newLimit: string) => {
        return makeSuccessEmbed({
            title: locale.__('settings_purge_limit.purge_limit_updated', { LIMIT: newLimit }),
            user: data.getUser()
        });
    }
};

export default async (data: HybridInteractionMessage, args: any, guild: Guild, locale: I18n) => {
    let member = data.getMember();
    if (!member) return;

    const GuildCache = await Cache.getCachedGuild(guild.id);
    if (!GuildCache) return;

    // TODO: Remove this feature when ready from early access
    if (!GuildCache.EarlyAccess_Enabled)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [COMMON_EMBEDS.EARLY_ACCESS_WARNING(data, locale)]
        });

    const limit = GuildCache.Purge_Limit;

    if (
        !(await checkMemberPermissionsInGuild({
            member,
            data,
            locale,
            permissions: [PermissionsBitField.Flags.ManageGuild]
        }))
    )
        return;

    let newLimit: string | null | undefined;
    if (data.isMessage()) {
        let _name: string;
        if (typeof args[1] === 'undefined')
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.PURGE_INFO(data, locale, limit.toString())]
            });

        let __name = args;
        __name.shift();
        _name = __name.join(' ');
        newLimit = _name;
    } else if (data.isApplicationCommand())
        newLimit = data.getSlashCommand().options.get('limit', true).value?.toString();

    if (typeof newLimit === 'undefined' || newLimit === null)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PURGE_INFO(data, locale, limit.toString())]
        });

    let parsedLimit = parseInt(newLimit);
    if (isNaN(parsedLimit))
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PURGE_NAN(data, locale)]
        });

    if (parsedLimit > MAX_GLOBAL_PURGE_LIMIT)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PURGE_TOO_BIG(data, locale)]
        });

    if (parsedLimit === 0)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PURGE_ZERO(data, locale)]
        });

    let placeholder: HybridInteractionMessage | undefined;

    let _placeholder = await sendHybridInteractionMessageResponse(data, {
        embeds: [COMMON_EMBEDS.PROCESSING(data, locale)]
    });
    if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

    await Prisma.client.guild.update({
        where: { id: guild.id },
        data: { Purge_Limit: parsedLimit }
    });
    Cache.updateGuildCache(guild.id);

    if (data && data.isMessage() && placeholder && placeholder.isMessage())
        return placeholder.getMessage().edit({ embeds: [EMBEDS.PURGE_UPDATED(data, locale, newLimit)] });
    else if (data.isApplicationCommand())
        return await sendHybridInteractionMessageResponse(
            data,
            { embeds: [EMBEDS.PURGE_UPDATED(data, locale, newLimit)] },
            true
        );
};
