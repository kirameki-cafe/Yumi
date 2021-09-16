import { Message, Permissions } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendReply, makeErrorEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";

export default class Say {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'say') return;

        if(!message.guildId) return;
        if(message.member === null) return;
        if(message.guild === null) return;

        if (!message.member.permissions.has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_CHANNELS]))
            return await sendReply(message, {
                embeds: [makeErrorEmbed ({
                    title: 'You need ``VIEW_CHANNEL, SEND_MESSAGES and MANAGE_CHANNELS`` permission on this guild!',
                    user: message.author
                })]
            });

        if(args.length === 0)
            return await sendReply(message, {
                embeds: [makeErrorEmbed({
                    title: `No message defined`,
                    user: message.author
                })]
            });

        await message.channel.send({ content: args.join(" ") });
    }
}