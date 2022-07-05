import { Guild, PermissionsBitField } from 'discord.js';
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
import Locale from '../../providers/Locale';
import { checkMemberPermissions } from '../../utils/DiscordPermission';

const EMBEDS = {
    LANGUAGE_INFO: (data: HybridInteractionMessage, locale: I18n, currentLocale: string) => {
        return makeInfoEmbed({
            title: locale.__('settings_language.info', { LANGUAGE: currentLocale }),
            description: locale.__('settings_language.info_description', {
                LANGUAGES: Locale.getLocaleProvider('en').getLocales().join(', ')
            }),
            user: data.getUser()
        });
    },
    LANGUAGE_INVALID: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('settings_language.language_invalid'),
            description: locale.__('settings_language.language_invalid_description'),
            user: data.getUser()
        });
    },
    LANGUAGE_UPDATED: (data: HybridInteractionMessage, locale: I18n, newLanguage: string) => {
        return makeSuccessEmbed({
            title: locale.__({ phrase: 'settings_language.language_updated', locale: newLanguage }),
            description: locale.__(
                { phrase: 'settings_language.language_updated_description', locale: newLanguage },
                { LANGUAGE: newLanguage }
            ),
            user: data.getUser()
        });
    }
};

export default async (data: HybridInteractionMessage, args: any, guild: Guild, locale: I18n) => {
    let member = data.getMember();
    if (!member) return;

    const GuildCache = await Cache.getCachedGuild(guild.id);
    if (!GuildCache) return;
    const language = GuildCache.locale;

    if (!(await checkMemberPermissions({ member, data, locale, permissions: [PermissionsBitField.Flags.ManageGuild] })))
        return;

    let newLanguage: string | null | undefined;
    if (data.isMessage()) {
        let _name: string;
        if (typeof args[1] === 'undefined')
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.LANGUAGE_INFO(data, locale, language)]
            });

        let __name = args;
        __name.shift();
        _name = __name.join(' ');
        newLanguage = _name;
    } else if (data.isApplicationCommand())
        newLanguage = data.getSlashCommand().options.get('language', true).value?.toString();

    if (!newLanguage)
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.LANGUAGE_INFO(data, locale, language)]
        });

    newLanguage = newLanguage.toLowerCase();

    if (!Locale.getLocaleProvider('en').getLocales().includes(newLanguage))
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.LANGUAGE_INVALID(data, locale)]
        });

    let placeholder: HybridInteractionMessage | undefined;

    let _placeholder = await sendHybridInteractionMessageResponse(data, {
        embeds: [COMMON_EMBEDS.PROCESSING(data, locale)]
    });
    if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

    await Prisma.client.guild.update({
        where: { id: guild.id },
        data: { locale: newLanguage }
    });
    Cache.updateGuildCache(guild.id);

    if (data && data.isMessage() && placeholder && placeholder.isMessage())
        return placeholder.getMessage().edit({ embeds: [EMBEDS.LANGUAGE_UPDATED(data, locale, newLanguage)] });
    else if (data.isApplicationCommand())
        return await sendHybridInteractionMessageResponse(
            data,
            { embeds: [EMBEDS.LANGUAGE_UPDATED(data, locale, newLanguage)] },
            true
        );
};
