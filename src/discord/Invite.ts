import { Message, CommandInteraction, Interaction } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import Users from "../services/Users"
import Environment from "../providers/Environment";

const EMBEDS = {
    INVITE_INFO: (data: Message | Interaction) => {
        let message;
        if(Users.isDeveloper(data.member?.user.id!) || !Environment.get().PRIVATE_BOT)
            message = `[Invite ${DiscordProvider.client.user?.username} to your server!](https://discord.com/api/oauth2/authorize?client_id=${DiscordProvider.client.user?.id}&permissions=0&scope=bot%20applications.commands)`;
       
        return makeInfoEmbed({
            title: `Invite`,
            description: message || `${DiscordProvider.client.user?.username}'s invite is currently private. Only the developers can add me to another server`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class Invite {
    
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'invite') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'invite') return;
            await this.process(interaction, interaction.options);
        }
    }


    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        return await sendMessageOrInteractionResponse(data, { embeds:[EMBEDS.INVITE_INFO(data)] });
    }
}