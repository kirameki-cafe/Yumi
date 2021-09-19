import { Message, Interaction, CommandInteraction, Permissions } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse, sendReply } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import {registerAllGuildsCommands, unregisterAllGuildsCommands} from "../utils/DiscordInteraction";
import Prisma from "../providers/Prisma";
import Users from "../services/Users";
import Cache from "../providers/Cache";

const EMBEDS = {
    SETTINGS_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Settings',
            description: `Change how ${DiscordProvider.client.user?.username} behave on ${data.guild?.name}`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``setPrefix``'
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
    NO_PERMISSION: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'You need ``ADMINISTRATOR`` permission on this guild!',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_PREFIX_PROVIDED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'No prefix provided',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PREFIX_TOO_LONG: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Prefix too long',
            description: `I bet you can't even remember that`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PREFIX_IS_MENTION: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Prefix cannot be mention of me',
            description: `You can already call me by mentioning me. I got that covered, don't worry`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PREFIX_UPDATED: (data: Message | Interaction, newPrefix: string) => {
        return makeSuccessEmbed ({
            title: 'Prefix updated',
            description: `From now onwards, I shall be called by using \`\`${newPrefix}\`\``,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
}

export default class Settings {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'settings') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'settings') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        if(data.guild === null || data.guildId === null) return;
        
        const Guild = await Prisma.client.guild.findFirst({ where: { id: data.guildId }})
        if(!Guild) throw new Error('TODO: Handle if guild is not found');

        const funct = {
            setPrefix: async(data: Message | Interaction) => {

                if(data === null || !data.guildId || data.member === null || data.guild === null) return;

                if(data instanceof Message) {
                    if (!data.member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });
                }
                else if(isSlashCommand) {
                    if(!data.guild.members.cache.get(data.user.id)?.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });
                }
        

                let newPrefix: string | undefined;
                if(data instanceof Message) {
                    let _name: string;
                    if(typeof args[1] === 'undefined')
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PREFIX_PROVIDED(data)] });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");
                    newPrefix = _name;
                }
                else if(data instanceof CommandInteraction)
                    newPrefix = data.options.getString('prefix')!;

                if(!newPrefix)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PREFIX_PROVIDED(data)] });

                if(newPrefix.length > 200)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PREFIX_TOO_LONG(data)] });

                if(newPrefix.startsWith(`<@!${DiscordProvider.client.user?.id}>`))
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PREFIX_IS_MENTION(data)] });

                let placeholder = await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });
                await Prisma.client.guild.update({ where: { id: data.guildId! }, data: { prefix: newPrefix }});
                Cache.updateGuildCache(data.guildId!);

                if(isMessage)
                    return (placeholder as Message).edit({ embeds: [EMBEDS.PREFIX_UPDATED(data, newPrefix)] });
                else if(isSlashCommand)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PREFIX_UPDATED(data, newPrefix)]}, true);
            }
        }

        let query;

        if(isMessage) {
            if(data === null || !data.guildId || data.member === null || data.guild === null) return;
            
            if(args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SETTINGS_INFO(data)] });
            }
            query = args[0].toLowerCase();

        }
        else if(isSlashCommand) {
            query = args.getSubcommand();
        }

        switch(query) {
            case "info":
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SETTINGS_INFO(data)] });
            case "setprefix":
                return await funct.setPrefix(data);
        }

    }
}