import { Guild, GuildChannelResolvable, GuildMember } from 'discord.js';
import { I18n } from 'i18n';
import { COMMON_EMBEDS } from '../discord/Settings';
import { sendHybridInteractionMessageResponse } from './DiscordMessage';
import { HybridInteractionMessage } from './DiscordModule';

export async function checkMemberPermissionsInGuild({
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
            embeds: [COMMON_EMBEDS.MEMBER_NO_PERMISSION(data, locale, permissions)]
        });

    return hasPermissions;
}

export async function checkMemberPermissionsInChannel({
    member,
    channel,
    permissions,
    data,
    locale
}: {
    member: GuildMember;
    channel: GuildChannelResolvable;
    permissions: bigint[];
    data?: HybridInteractionMessage;
    locale?: I18n;
}): Promise<boolean> {
    const hasPermissions = member.permissionsIn(channel).has(permissions);

    if (!hasPermissions && data && locale)
        await sendHybridInteractionMessageResponse(data, {
            embeds: [COMMON_EMBEDS.MEMBER_NO_PERMISSION(data, locale, permissions)]
        });

    return hasPermissions;
}

export async function checkBotPermissionsInGuild({
    guild,
    permissions,
    data,
    locale
}: {
    guild: Guild;
    permissions: bigint[];
    data?: HybridInteractionMessage;
    locale?: I18n;
}): Promise<boolean> {
    const member = guild.members.me;
    if(!member) return false;

    const hasPermissions = member.permissions.has(permissions);

    if (!hasPermissions && data && locale)
        await sendHybridInteractionMessageResponse(data, {
            embeds: [COMMON_EMBEDS.BOT_NO_PERMISSION(data, locale, permissions)]
        });

    return hasPermissions;
}

export async function checkBotPermissionsInChannel({
    guild,
    channel,
    permissions,
    data,
    locale
}: {
    guild: Guild;
    channel: GuildChannelResolvable;
    permissions: bigint[];
    data?: HybridInteractionMessage;
    locale?: I18n;
}): Promise<boolean> {
    const member = guild.members.me;
    if(!member) return false;

    const hasPermissions = member.permissionsIn(channel).has(permissions);

    if (!hasPermissions && data && locale)
        await sendHybridInteractionMessageResponse(data, {
            embeds: [COMMON_EMBEDS.BOT_NO_PERMISSION(data, locale, permissions)]
        });

    return hasPermissions;
}