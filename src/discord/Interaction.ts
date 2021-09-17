import { Message } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendReply } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import {registerAllGuildsCommands, unregisterAllGuildsCommands} from "../utils/DiscordInteraction";
import Prisma from "../providers/Prisma";

export default class Interaction {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'interaction') return;

        if(!message.guildId) return;
        if(message.member === null) return;
        if(message.guild === null) return;

        // TODO: Add dev check
        
        if(args.length === 0)
            return await sendReply(message, {
                embeds: [makeInfoEmbed ({
                    title: 'Interaction',
                    description: `Manage interaction`,
                    fields: [
                        {
                            name: 'Available arguments',
                            value: '``reloadAll``'
                        }
                    ],
                    user: message.author
                })]
            });
        else {
            if(args[0].toLowerCase() === "reloadall") {
                try {
                    await unregisterAllGuildsCommands();
                    await registerAllGuildsCommands();
                    return await sendReply(message, {
                        embeds: [makeSuccessEmbed ({
                            title: 'Reloaded all Interaction',
                            user: message.author
                        })]
                    });
                } catch (err) {
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'An error occurred while trying to reload interaction',
                            description: '```' + err + '```',
                            user: message.author
                        })]
                    });
                } 
            }
        }
    }
}