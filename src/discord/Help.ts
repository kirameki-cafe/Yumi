import { Interaction, Message } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendReply, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";

export default class Help {

    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'help') return;
        this.sendHelpMessage(false, message);
    }

    async interactionCreate(interaction: Interaction) {
        this.sendHelpMessage(true, interaction);
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
            user: data.author
        });

        if(isSlashCommand) {
            data.replay({ ephemeral: true, embeds: [embed] });
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