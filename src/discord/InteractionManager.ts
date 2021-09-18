import { Message, Interaction, CommandInteraction } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse, sendReply } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import {registerAllGuildsCommands, unregisterAllGuildsCommands} from "../utils/DiscordInteraction";
import Prisma from "../providers/Prisma";
import Users from "../services/Users";

const EMBEDS = {
    INTERACTION_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Interaction',
            description: `This module contains management tool for interaction based contents`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``reloadAll``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PROCESSING: (data: Message | Interaction) => {
        return makeProcessingEmbed({
            icon: (data instanceof Message) ? undefined : '⌛',
            title: `Performing actions`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NOT_DEVELOPER: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Developer only',
            description: `This command is restricted to the developers only`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    RELOADALL_SUCCESS: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: 'Reloaded all Interaction',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    RELOADALL_ERROR: (data: Message | Interaction, err: any) => {
        return makeErrorEmbed ({
            title: 'An error occurred while trying to reload interaction',
            description: '```' + err + '```',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    }
}

export default class InteractionManager {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'interaction') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'interaction') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        if(!Users.isDeveloper(data.member?.user.id!))
            return await sendMessageOrInteractionResponse(data, { embeds:[EMBEDS.NOT_DEVELOPER(data)] });

        const funct = {
            reloadAll: async(data: Message | Interaction) => {
                let placeholder = await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });
                try {
                    await unregisterAllGuildsCommands();
                    await registerAllGuildsCommands();
                    if(isMessage)
                        return (placeholder as Message).edit({ embeds: [EMBEDS.RELOADALL_SUCCESS(data)] });
                    else if(isSlashCommand)
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.RELOADALL_SUCCESS(data)]}, true);
                } catch (err) {
                    if(isMessage)
                        (placeholder as Message).edit({ embeds: [EMBEDS.RELOADALL_ERROR(data, err)] });
                    else if(isSlashCommand)
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.RELOADALL_ERROR(data, err)] }, true);
                } 
            }
        }

        let query;

        if(isMessage) {
            if(data === null || !data.guildId || data.member === null || data.guild === null) return;
            
            if(args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.INTERACTION_INFO(data)] });
            }
            query = args[0].toLowerCase();

        }
        else if(isSlashCommand) {
            query = args.getSubcommand();
        }

        switch(query) {
            case "info":
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.INTERACTION_INFO(data)] });
            case "reloadall":
                return await funct.reloadAll(data);
        }

    }
}


export class AInteractionManager {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'interaction') return;

        if(!message.guildId) return;
        if(message.member === null) return;
        if(message.guild === null) return;

        // TODO: Add dev check
        
        if(args.length === 0)
            return await sendReply(message, {
                embeds: [makeInfoEmbed ({
 
                    user: message.author
                })]
            });
        else {
            if(args[0].toLowerCase() === "reloadall") {
                
            }
        }
    }
}