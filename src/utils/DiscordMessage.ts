import { MessageEmbed, User, MessagePayload, MessageOptions, TextBasedChannels, TextChannel, DMChannel, BaseGuildTextChannel, Message, ColorResolvable, Interaction, InteractionReplyOptions } from "discord.js";
import App from "..";
import Logger from "../libs/Logger";

const emotes = {
    "yumiloading": "<a:yumiloading:887350424938627173>"
};

export function makeEmbed(icon: string | undefined, title: string, description: any, color: ColorResolvable, fields: any, user: User, setTimestamp: boolean) {
    
    const embed = new MessageEmbed();
    embed.setColor(color || '#FFFFFF');

    if(typeof icon === 'undefined')
        embed.setTitle(title);
    else
        embed.setTitle(`${icon}  ${title}`);

    if (typeof description !== 'undefined')
        embed.setDescription(description)

    if(setTimestamp)
        embed.setTimestamp();

    if(typeof user !== 'undefined')
        embed.setFooter(`${user.username}  |  v${App.version}`, (user.avatarURL() || ''));
    else
        embed.setFooter(`v${App.version}`, '');
    
    if (typeof fields !== 'undefined')
        embed.addFields(fields);
    
    return embed;

}

export function makeSuccessEmbed(options: any) {
    return makeEmbed(typeof options.icon === 'undefined' ? "✅" : options.icon, options.title, options.description, '#B5EAD7', options.fields, options.user, options.setTimestamp || true);
}

export function makeErrorEmbed(options: any) {
    return makeEmbed(typeof options.icon === 'undefined' ? "❌" : options.icon, options.title, options.description, '#FF9AA2', options.fields, options.user, options.setTimestamp || true);
}

export function makeProcessingEmbed(options: any) {
    return makeEmbed(typeof options.icon === 'undefined' ? getEmotes().yumiloading : options.icon, options.title, options.description, '#E2F0CB', options.fields, options.user, options.setTimestamp || true);
}

export function makeInfoEmbed(options: any) {
    return makeEmbed(typeof options.icon === 'undefined' ? "🔮" : options.icon, options.title, options.description, '#C7CEEA', options.fields, options.user, options.setTimestamp || true);
}

export async function sendMessage(channel: TextChannel | DMChannel | BaseGuildTextChannel | TextBasedChannels, user: User | undefined, options: string | MessagePayload | MessageOptions) {
    
    let message;

    try { message = await channel.send(options); }
    catch(error) {
        if(typeof user === 'undefined') return;
        try { message = await user.send(options); }
        catch(errorDM) {
            Logger.error(`Cannot find available destinations to send the message CID: ${channel.id} UID: ${user.id} C_ERR: ${error} DM_ERR: ${errorDM}`);
            return;
        }
    } finally {
        return message;
    }
    
}

export async function sendReply(rMessage: Message, options: string | MessagePayload | MessageOptions) {
    
    let message;

    try { message = await rMessage.reply(options); }
    catch(error) {
        try { message = await rMessage.author.send(options); }
        catch(errorDM) {
            Logger.error(`Cannot find available destinations to reply the message to. MID: ${rMessage.id} CID: ${rMessage.channel.id} UID: ${rMessage.author.id} C_ERR: ${error} DM_ERR: ${errorDM}`);
            return;
        }
    } finally {
        return message;
    }
    
}


export async function sendMessageOrInteractionResponse(data: Message | Interaction, payload: MessageOptions | InteractionReplyOptions, replace?: boolean) {
    const isSlashCommand = data instanceof Interaction && data.isCommand();
    const isMessage = data instanceof Message;

    if(isSlashCommand) {
        if(!data.replied) {
            let message;
            try {
                if(!data.deferred)
                    return await data.reply(payload);
                else
                    return await data.editReply(payload);
            }
            catch(errorDM) {
                Logger.error(`Cannot find available destinations to send the message CID: ${data.channel!.id} UID: ${data.user.id} DM_ERR: ${errorDM}`);
                return;
            } finally {
                return message;
            }
        }
        else {
            let message;
            try { 
                if(replace)
                    return await data.editReply(payload);
                else
                    return await data.followUp(payload); 
            }
            catch(errorDM) {
                Logger.error(`Cannot find available destinations to send the message CID: ${data.channel!.id} UID: ${data.user.id} DM_ERR: ${errorDM}`);
                return;
            } finally {
                return message;
            }
        }
    }
    else if(isMessage) return await sendReply(data, payload);
}

export function getEmotes() {
    return emotes;
}