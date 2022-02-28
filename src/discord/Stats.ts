import { Message, CommandInteraction, Interaction } from "discord.js";
import { sendMessageOrInteractionResponse, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import os from "os-utils";

const EMBEDS = {
    STATS_INFO: (data: Message | Interaction) => {
        let message;
        
        return makeInfoEmbed({
            title: `Stats`,
            icon: '📊',
            description: 'Stats of the bot',
            fields: [
                {
                    name: '🌐 Users',
                    value: `${DiscordProvider.client.guilds.cache.size} servers\n${DiscordProvider.client.guilds.cache.map((g) => g.memberCount).reduce((a, c) => a + c)} users`,
                    inline: true
                },
                {
                    name: '🟢 Uptime since',
                    value: `System: <t:${(Math.round(new Date().getTime() / 1000)) - Math.round(os.sysUptime())}:R>\nProcess: <t:${(Math.round(new Date().getTime() / 1000)) - Math.round(os.processUptime())}:R>`,
                    inline: true
                }
            ],
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