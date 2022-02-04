import { Message, CommandInteraction, Interaction } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import Users from "../services/Users"
import Environment from "../providers/Environment";

const EMBEDS = {
    STATS_INFO: (data: Message | Interaction) => {
        let message;
        
        return makeInfoEmbed({
            title: `Stats`,
            icon: '📊',
            description: `Serving in ${DiscordProvider.client.guilds.cache.size} servers\n${DiscordProvider.client.guilds.cache.map((g) => g.memberCount).reduce((a, c) => a + c)} users`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class Stats {
    
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'stats') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'stats') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;
        
        return await sendMessageOrInteractionResponse(data, { embeds:[EMBEDS.STATS_INFO(data)] });
    }
}