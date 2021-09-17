import { Message, Permissions, CommandInteraction } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendReply, makeErrorEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";

export default class Say {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'say') return;

        if(!message.guildId) return;
        if(message.member === null) return;
        if(message.guild === null) return;

        await this.sendSayMessage(false, message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(typeof interaction.commandName === 'undefined')  return;
        if((interaction.commandName).toLowerCase() !== 'say') return;
        await this.sendSayMessage(true, interaction, interaction.options.getString('message'));
    }

    async sendSayMessage(isSlashCommand: boolean, data: any, args: any) {

        if (!data.member.permissions.has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_CHANNELS]))
            return await sendReply(data, {
                embeds: [makeErrorEmbed ({
                    title: 'You need ``VIEW_CHANNEL, SEND_MESSAGES and MANAGE_CHANNELS`` permission on this guild!',
                    user: isSlashCommand ? data.user : data.author
                })]
            });


        if(args.length === 0)
            return await sendReply(data, {
                embeds: [makeErrorEmbed({
                    title: `No message defined`,
                    user: isSlashCommand ? data.user : data.author
                })]
            });

        if(isSlashCommand) {
            await data.channel.send({ content: args });
            await data.reply({ ephemeral: true, embeds: [makeSuccessEmbed({
                title: `Successfully said`,
                user: isSlashCommand ? data.user : data.author
            })] });
        }
        else {
            await data.channel.send({ content: args.join(" ") });
        }

    }
}