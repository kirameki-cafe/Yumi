import {
    EmbedBuilder,
    User,
    MessagePayload,
    MessageOptions,
    GuildTextBasedChannel,
    TextChannel,
    DMChannel,
    PartialDMChannel,
    BaseGuildTextChannel,
    Message,
    ColorResolvable,
    Interaction,
    InteractionReplyOptions,
    BaseInteraction
} from 'discord.js';

import App from '..';
import { HybridInteractionMessage } from './DiscordModule';
import Logger from '../libs/Logger';

const emotes = {
    yumiloading: '<a:yumiloading:983269480085983262>'
};

interface EmbedData {
    icon?: string | null;
    title: string;
    description?: any;
    color?: ColorResolvable;
    fields?: any;
    user?: User | null;
    setTimestamp: boolean;
}

interface EmbedDataPresets {
    icon?: string | null;
    title: string;
    description?: any;
    color?: ColorResolvable;
    fields?: any;
    user?: User | null;
    setTimestamp?: boolean;
}

export function makeEmbed(data: EmbedData) {
    const embed = new EmbedBuilder();
    embed.setColor(data.color || '#FFFFFF');

    if (!data.icon) embed.setTitle(data.title);
    else embed.setTitle(`${data.icon}  ${data.title}`);

    if (data.description) embed.setDescription(data.description);

    if (data.setTimestamp) embed.setTimestamp();

    if (data.user)
        embed.setFooter({
            text: `${data.user.username}  |  v${App.version}`,
            iconURL: `${data.user.displayAvatarURL()}?size=4096`
        });
    else
        embed.setFooter({
            text: `v${App.version}`
        });

    if (data.fields) embed.addFields(data.fields);

    return embed;
}

export function makeInfoEmbed(data: EmbedDataPresets) {
    return makeEmbed({
        icon: !data.icon && data.icon !== null ? '🔮' : data.icon,
        title: data.title,
        description: data.description,
        color: '#C7CEEA',
        fields: data.fields,
        user: data.user,
        setTimestamp: data.setTimestamp || true
    });
}

export function makeSuccessEmbed(data: EmbedDataPresets) {
    return makeEmbed({
        icon: !data.icon && data.icon !== null ? '✅' : data.icon,
        title: data.title,
        description: data.description,
        color: '#B5EAD7',
        fields: data.fields,
        user: data.user,
        setTimestamp: data.setTimestamp || true
    });
}

export function makeWarningEmbed(data: EmbedDataPresets) {
    return makeEmbed({
        icon: !data.icon && data.icon !== null ? '⚠️' : data.icon,
        title: data.title,
        description: data.description,
        color: '#FFEEAD',
        fields: data.fields,
        user: data.user,
        setTimestamp: data.setTimestamp || true
    });
}

export function makeErrorEmbed(data: EmbedDataPresets) {
    return makeEmbed({
        icon: !data.icon && data.icon !== null ? '❌' : data.icon,
        title: data.title,
        description: data.description,
        color: '#FF9AA2',
        fields: data.fields,
        user: data.user,
        setTimestamp: data.setTimestamp || true
    });
}

export function makeProcessingEmbed(data: EmbedDataPresets) {
    return makeEmbed({
        icon: !data.icon && data.icon !== null ? getEmotes().yumiloading : data.icon,
        title: data.title,
        description: data.description,
        color: '#E2F0CB',
        fields: data.fields,
        user: data.user,
        setTimestamp: data.setTimestamp || true
    });
}

export async function sendMessage(
    channel: TextChannel | DMChannel | BaseGuildTextChannel | GuildTextBasedChannel | PartialDMChannel,
    user: User | undefined,
    options: string | MessagePayload | MessageOptions
) {
    let message;

    try {
        message = await channel.send(options);
    } catch (error) {
        if (typeof user === 'undefined') {
            return Logger.error(
                `Cannot find available destinations to send the message CID: ${channel.id} C_ERR: ${error}`
            );
        }
        try {
            message = await user.send(options);
        } catch (errorDM) {
            Logger.error(
                `Cannot find available destinations to send the message CID: ${channel.id} UID: ${user.id} C_ERR: ${error} DM_ERR: ${errorDM}`
            );
            return;
        }
    } finally {
        return message;
    }
}

export async function sendHybridInteractionMessageResponse(
    data: HybridInteractionMessage,
    payload: MessageOptions | InteractionReplyOptions,
    replace = false
): Promise<Message | BaseInteraction | undefined> {
    if (data.isApplicationCommand() || data.isButton() || data.isSelectMenu()) {
        const messageComponent = data.getMessageComponentInteraction();

        if (!messageComponent.replied) {
            let message;
            try {
                if (!messageComponent.deferred) {
                    await messageComponent.reply(payload as InteractionReplyOptions);
                    return messageComponent;
                } else {
                    await messageComponent.editReply(payload);
                    return messageComponent;
                }
            } catch (errorDM) {
                Logger.error(
                    `Cannot find available destinations to send the message CID: ${messageComponent.channel!.id} UID: ${
                        messageComponent.user.id
                    } DM_ERR: ${errorDM}`
                );
                return;
            } finally {
                return message;
            }
        } else {
            let message;
            try {
                if (replace) return (await messageComponent.editReply(payload)) as Message;
                else return (await messageComponent.followUp(payload as InteractionReplyOptions)) as Message;
            } catch (errorDM) {
                Logger.error(
                    `Cannot find available destinations to send the message CID: ${messageComponent.channel!.id} UID: ${
                        messageComponent.user.id
                    } DM_ERR: ${errorDM}`
                );
                return;
            } finally {
                return message;
            }
        }
    } else if (data.isMessage()) return await sendReply(data.getMessage(), payload as MessageOptions);
}

export function getEmotes() {
    return emotes;
}

async function sendReply(rMessage: Message, options: string | MessagePayload | MessageOptions) {
    let message;

    try {
        message = await rMessage.reply(options);
    } catch (error) {
        try {
            message = await rMessage.author.send(options);
        } catch (errorDM) {
            Logger.error(
                `Cannot find available destinations to reply the message to. MID: ${rMessage.id} CID: ${rMessage.channel.id} UID: ${rMessage.author.id} C_ERR: ${error} DM_ERR: ${errorDM}`
            );
            return;
        }
    } finally {
        return message;
    }
}
