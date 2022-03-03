import DiscordModule, { HybridInteractionMessage } from "../utils/DiscordModule";

import { Message, Permissions, Interaction, CommandInteraction } from "discord.js";
import { makeSuccessEmbed, sendHybridInteractionMessageResponse, makeErrorEmbed, makeInfoEmbed } from "../utils/DiscordMessage";

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

export default class Say extends DiscordModule {

    public id = "Discord_Say";
    public commands = ["say"];
    public commandInteractionName = "say";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) { 
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        let query;

        if(data.isMessage()) {
            const message = data.getMessage();

            if(!message.member) return;

            if (!message.member.permissions.has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_CHANNELS]))
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data.getRaw())] });

            if(args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SAY_INFO(data.getRaw())] });

            query = args.join(" ");
        }
        else if(data.isSlashCommand()) {
            const interaction = data.getSlashCommand();
            if(!data.getGuild()!.members.cache.get(interaction.user.id)?.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data.getRaw())] });

            query = interaction.options.getString('message');
        }

        if(data.isSlashCommand() && data.getChannel()) {
            await data.getChannel()!.send({ content: query });
            await data.getMessageComponentInteraction().reply({ ephemeral: true, embeds: [EMBEDS.SUCCESSFULLY_SAID(data.getRaw())] });
        }
        else if(data.isMessage()) {
            const message = data.getMessage();
            if(message.deletable)
                await message.delete();

            await data.getChannel()!.send({ content: query });
        }

    }
}