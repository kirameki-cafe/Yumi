import {
    MessageEmbed,
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
    CommandInteraction
} from 'discord.js';

import App from '..';
import { HybridInteractionMessage } from './DiscordModule';
import Logger from '../libs/Logger';

const emotes = {
    yumiloading: '<a:yumiloading:983269480085983262>'
};

export function makeEmbed(
    icon: string | undefined,
    title: string,
    description: any,
    color: ColorResolvable,
    fields: any,
    user: User,
    setTimestamp: boolean
) {
    const embed = new MessageEmbed();
    embed.setColor(color || '#FFFFFF');

    if (typeof icon === 'undefined') embed.setTitle(title);
    else embed.setTitle(`${icon}  ${title}`);

    if (typeof description !== 'undefined') embed.setDescription(description);

    if (setTimestamp) embed.setTimestamp();

    if (typeof user !== 'undefined')
        embed.footer = {
            text: `${user.username}  |  v${App.version}`,
            iconURL: `${user.displayAvatarURL()}?size=4096`
        };
    else
        embed.footer = {
            text: `v${App.version}`
        };

    if (typeof fields !== 'undefined') embed.addFields(fields);

    return embed;
}

export function makeSuccessEmbed(options: any) {
    return makeEmbed(
        typeof options.icon === 'undefined' ? '✅' : options.icon,
        options.title,
        options.description,
        '#B5EAD7',
        options.fields,
        options.user,
        options.setTimestamp || true
    );
}

export function makeWarningEmbed(options: any) {
    return makeEmbed(
        typeof options.icon === 'undefined' ? '⚠️' : options.icon,
        options.title,
        options.description,
        '#FFEEAD',
        options.fields,
        options.user,
        options.setTimestamp || true
    );
}

export function makeErrorEmbed(options: any) {
    return makeEmbed(
        typeof options.icon === 'undefined' ? '❌' : options.icon,
        options.title,
        options.description,
        '#FF9AA2',
        options.fields,
        options.user,
        options.setTimestamp || true
    );
}

export function makeProcessingEmbed(options: any) {
    return makeEmbed(
        typeof options.icon === 'undefined' ? getEmotes().yumiloading : options.icon,
        options.title,
        options.description,
        '#E2F0CB',
        options.fields,
        options.user,
        options.setTimestamp || true
    );
}

export function makeInfoEmbed(options: any) {
    return makeEmbed(
        typeof options.icon === 'undefined' ? '🔮' : options.icon,
        options.title,
        options.description,
        '#C7CEEA',
        options.fields,
        options.user,
        options.setTimestamp || true
    );
}

export async function sendMessage(
    channel:
        | TextChannel
        | DMChannel
        | BaseGuildTextChannel
        | GuildTextBasedChannel
        | PartialDMChannel,
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

export async function sendReply(
    rMessage: Message,
    options: string | MessagePayload | MessageOptions
) {
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

export async function sendMessageOrInteractionResponse(
    data: Message | Interaction,
    payload: MessageOptions | InteractionReplyOptions,
    replace = false
) {
    const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
    const isMessage = data instanceof Message;

    if (
        isSlashCommand ||
        (data instanceof Interaction && (data.isSelectMenu() || data.isButton()))
    ) {
        if (!data.replied) {
            let message;
            try {
                if (!data.deferred) return await data.reply(payload as InteractionReplyOptions);
                else return await data.editReply(payload);
            } catch (errorDM) {
                Logger.error(
                    `Cannot find available destinations to send the message CID: ${
                        data.channel!.id
                    } UID: ${data.user.id} DM_ERR: ${errorDM}`
                );
                return;
            } finally {
                return message;
            }
        } else {
            let message;
            try {
                if (replace) return await data.editReply(payload);
                else return await data.followUp(payload as InteractionReplyOptions);
            } catch (errorDM) {
                Logger.error(
                    `Cannot find available destinations to send the message CID: ${
                        data.channel!.id
                    } UID: ${data.user.id} DM_ERR: ${errorDM}`
                );
                return;
            } finally {
                return message;
            }
        }
    } else if (isMessage) return await sendReply(data, payload as MessageOptions);
}

export async function sendHybridInteractionMessageResponse(
    data: HybridInteractionMessage,
    payload: MessageOptions | InteractionReplyOptions,
    replace = false
): Promise<Message | Interaction | undefined> {
    if (data.isSlashCommand() || data.isButton() || data.isSelectMenu()) {
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
                    `Cannot find available destinations to send the message CID: ${
                        messageComponent.channel!.id
                    } UID: ${messageComponent.user.id} DM_ERR: ${errorDM}`
                );
                return;
            } finally {
                return message;
            }
        } else {
            let message;
            try {
                if (replace) return (await messageComponent.editReply(payload)) as Message;
                else
                    return (await messageComponent.followUp(
                        payload as InteractionReplyOptions
                    )) as Message;
            } catch (errorDM) {
                Logger.error(
                    `Cannot find available destinations to send the message CID: ${
                        messageComponent.channel!.id
                    } UID: ${messageComponent.user.id} DM_ERR: ${errorDM}`
                );
                return;
            } finally {
                return message;
            }
        }
    } else if (data.isMessage())
        return await sendReply(data.getMessage(), payload as MessageOptions);
}

export function getEmotes() {
    return emotes;
}
