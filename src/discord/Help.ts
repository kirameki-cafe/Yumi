import { CommandInteraction, Interaction, Message } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendReply, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";

export default class Help {

    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'help') return;
        this.sendHelpMessage(false, message);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(typeof interaction.commandName === 'undefined')  return;
        if((interaction.commandName).toLowerCase() !== 'help') return;
        await this.sendHelpMessage(true, interaction);
    }

    async sendHelpMessage(isSlashCommand: boolean, data: any) {

        const embed = makeInfoEmbed({
            icon: "💌",
            title: `Help - ${DiscordProvider.client.user?.username}`,
            fields: [
                {
                    name: 'Info',
                    value: `Yumi is currently undergoing complete rewrite, as expected, losing many of her functionality. All of the features will be re-implemented.`
                },
                {
                    name: 'Why?',
                    value: `Yumi was specifically written for use in a only 1 private server, now it's time to extend the border and globalize it (just kidding lol)`
                },
                {
                    name: 'Available commands',
                    value: '``help``\n``ping``\n``invite``\n``membershipscreening (ms)``\n``...14 commands has been hidden (FLAGS.BETA)``'
                }
            ],
            user:  isSlashCommand ? data.user : data.author
        });

        if(isSlashCommand) {
            data.reply({ ephemeral: false, embeds: [embed] });
        }

        else {
            let help = await sendReply(data, {
                embeds: [embed]
            });
    
            if(help)
                help.react("♥");
        }
    }
}