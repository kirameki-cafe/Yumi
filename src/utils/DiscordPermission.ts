import { GuildMember } from 'discord.js';
import { I18n } from 'i18n';
import { COMMON_EMBEDS } from '../discord/Settings';
import { sendHybridInteractionMessageResponse } from './DiscordMessage';
import { HybridInteractionMessage } from './DiscordModule';

export async function checkMemberPermissions({
    member,
    permissions,
    data,
    locale
}: {
    member: GuildMember;
    permissions: bigint[];
    data?: HybridInteractionMessage;
    locale?: I18n;
}): Promise<boolean> {
    const hasPermissions = member.permissions.has(permissions);

    if (!hasPermissions && data && locale)
        await sendHybridInteractionMessageResponse(data, {
            embeds: [COMMON_EMBEDS.NO_PERMISSION(data, locale, permissions)]
        });

    return hasPermissions;
}
