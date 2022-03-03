import DiscordModule, { HybridInteractionMessage } from "../utils/DiscordModule";

import { Message, Interaction, CommandInteraction } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendHybridInteractionMessageResponse } from "../utils/DiscordMessage";
import {registerAllGuildsCommands, unregisterAllGuildsCommands} from "../utils/DiscordInteraction";
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

export default class InteractionManager extends DiscordModule {

    public id = "Discord_InteractionManager";
    public commands = ["interaction"];
    public commandInteractionName = "interaction";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) { 
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        const user = data.getUser();
        if(!user) return;

        if(!Users.isDeveloper(user.id))
            return await sendHybridInteractionMessageResponse(data, { embeds:[EMBEDS.NOT_DEVELOPER(data.getRaw())] });

        const funct = {
            reloadAll: async(data: HybridInteractionMessage) => {

                let placeholder: (HybridInteractionMessage | undefined);

                let _placeholder = await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PROCESSING(data.getRaw())] });
                if (_placeholder)
                    placeholder = new HybridInteractionMessage(_placeholder);

                try {
                    await unregisterAllGuildsCommands();
                    await registerAllGuildsCommands();

                    if(data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder.getMessage().edit({ embeds: [EMBEDS.RELOADALL_SUCCESS(data.getRaw())] });
                    else if(data.isSlashCommand())
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.RELOADALL_SUCCESS(data.getRaw())]}, true);

                } catch (err) {
                    if(data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder.getMessage().edit({ embeds: [EMBEDS.RELOADALL_ERROR(data.getRaw(), err)] });
                    else if(data.isSlashCommand())
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.RELOADALL_ERROR(data.getRaw(), err)] }, true);
                } 
            }
        }

        let query;

        if(data.isMessage()) {
            if(args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INTERACTION_INFO(data.getRaw())] });

            query = args[0].toLowerCase();
        }
        else if(data.isSlashCommand()) {
            query = args.getSubcommand();
        }

        switch(query) {
            case "info":
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INTERACTION_INFO(data.getRaw())] });
            case "reloadall":
                return await funct.reloadAll(data);
        }

    }
}