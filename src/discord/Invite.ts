import { Message, CommandInteraction } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendReply, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";

export default class Invite {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'invite') return;

        await this.sendInviteMessage(false, message);

    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(typeof interaction.commandName === 'undefined')  return;
        if((interaction.commandName).toLowerCase() !== 'invite') return;
        await this.sendInviteMessage(true, interaction);
    }

    async sendInviteMessage(isSlashCommand: boolean, data: any) {

        const embed = makeInfoEmbed({
            title: `Invite`,
            description: `${DiscordProvider.client.user?.username}'s invite is currently disabled. Only the developers can add me to another server`,
            user: isSlashCommand ? data.user : data.author
        });

        if(isSlashCommand) {
            data.reply({ ephemeral: false, embeds: [embed] });
        }
        else {
            let help = await sendReply(data, {
                embeds: [embed]
            });
        }

    }
}