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

const EMBEDS = {
    PREFIX_INFO: (data: HybridInteractionMessage, locale: I18n, currentPrefix: string) => {
        return makeInfoEmbed({
            title: locale.__('settings_prefix.info', { PREFIX: currentPrefix}),
            description: locale.__('settings_prefix.info_description'),
            user: data.getUser()
        });
    },
    PREFIX_TOO_LONG: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('settings_prefix.prefix_too_long'),
            description: locale.__('settings_prefix.prefix_too_long_description'),
            user: data.getUser()
        });
    },
    PREFIX_IS_MENTION: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('settings_prefix.prefix_is_mention'),
            description: locale.__('settings_prefix.prefix_is_mention_description'),
            user: data.getUser()
        });
    },
    PREFIX_UPDATED: (data: HybridInteractionMessage, locale: I18n, newPrefix: string) => {
        return makeSuccessEmbed({
            title: locale.__('settings_prefix.prefix_updated'),
            description: locale.__('settings_prefix.prefix_updated_description', { PREFIX: newPrefix }),
            user: data.getUser()
        });
    }
};

export default async (data: HybridInteractionMessage, args: any, guild: Guild, locale: I18n) => {
    let member = data.getMember();
    if (!member) return;

    const GuildCache = await Cache.getCachedGuild(guild.id);
        if (!GuildCache) return;
    const prefix = GuildCache.prefix;

    const requiredPermissions = [PermissionsBitField.Flags.ManageGuild];

    if (!member.permissions.has(requiredPermissions))
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [COMMON_EMBEDS.NO_PERMISSION(data, locale, requiredPermissions)]
        });

    let newPrefix: string | null | undefined;
    if (data.isMessage()) {
        let _name: string;
        if (typeof args[1] === 'undefined')
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.PREFIX_INFO(data, locale, prefix)]
            });

        let __name = args;
        __name.shift();
        _name = __name.join(' ');
        newPrefix = _name;
    } else if (data.isApplicationCommand()) newPrefix = data.getSlashCommand().options.get('prefix', true).value?.toString();

    if (!newPrefix)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PREFIX_INFO(data, locale, prefix)]
        });

    if (newPrefix.length > 200)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PREFIX_TOO_LONG(data, locale)]
        });

    if (newPrefix.startsWith(`<@!${DiscordProvider.client.user?.id}>`) || newPrefix.startsWith(`<@${DiscordProvider.client.user?.id}>`))
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PREFIX_IS_MENTION(data, locale)]
        });

    let placeholder: HybridInteractionMessage | undefined;

    let _placeholder = await sendHybridInteractionMessageResponse(data, {
        embeds: [COMMON_EMBEDS.PROCESSING(data, locale)]
    });
    if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

    await Prisma.client.guild.update({
        where: { id: guild.id },
        data: { prefix: newPrefix }
    });
    Cache.updateGuildCache(guild.id);

    if (data && data.isMessage() && placeholder && placeholder.isMessage())
        return placeholder.getMessage().edit({ embeds: [EMBEDS.PREFIX_UPDATED(data, locale, newPrefix)] });
    else if (data.isApplicationCommand())
        return await sendHybridInteractionMessageResponse(
            data,
            { embeds: [EMBEDS.PREFIX_UPDATED(data, locale, newPrefix)] },
            true
        );
};
