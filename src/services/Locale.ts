import { Snowflake } from 'discord.js';
import { I18n } from 'i18n';

import Cache from '../providers/Cache';
import Locale from '../providers/Locale';

export async function getGuildLocale(id: Snowflake): Promise<I18n> {
    const cachedGuild = await Cache.getCachedGuild(id);
    if (!cachedGuild) return Locale.getLocaleProvider("en");

    const LocaleProvider = Locale.getLocaleProvider(cachedGuild.locale);
    return LocaleProvider;
}

export default {
    getGuildLocale
}