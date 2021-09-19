import { Message, Permissions, Interaction, CommandInteraction } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse, sendReply, makeErrorEmbed, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";

const EMBEDS = {
    SAY_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed ({
            title: 'Say',
            description: `Make me say something!`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``Your message``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_PERMISSION: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'You need ``VIEW_CHANNEL, SEND_MESSAGES and MANAGE_CHANNELS`` permission on this guild!',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SUCCESSFULLY_SAID: (data: Message | Interaction) => {
        return makeSuccessEmbed ({
            title: 'Successfully said',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class Say {

    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'say') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'say') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;
        
        let query;

        if(isMessage) {
            if(data === null || !data.guildId || data.member === null || data.guild === null) return;
            if (!data.member.permissions.has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_CHANNELS]))
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });

            if(args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SAY_INFO(data)] });
            }
            query = args.join(" ");

        }
        else if(isSlashCommand) {
            if(!data.guild!.members.cache.get(data.user.id)?.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });

            query = data.options.getString('message');
        }

        if(isSlashCommand) {
            await data.channel!.send({ content: query });
            await data.reply({ ephemeral: true, embeds: [EMBEDS.SUCCESSFULLY_SAID(data)] });
        }
        else {
            if(data.deletable)
                await data.delete();

            await data.channel.send({ content: query });
        }

    }
}