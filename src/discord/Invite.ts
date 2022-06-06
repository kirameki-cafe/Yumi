import { Message, CommandInteraction, Interaction } from 'discord.js';

import Environment from '../providers/Environment';
import DiscordProvider from '../providers/Discord';
import Users from '../services/Users';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from '../utils/DiscordMessage';

const EMBEDS = {
    INVITE_INFO: (data: Message | Interaction) => {
        let message;
        if (Users.isDeveloper(data.member?.user.id!) || !Environment.get().PRIVATE_BOT)
            message = `[Invite ${DiscordProvider.client.user?.username} to your server!](https://discord.com/api/oauth2/authorize?client_id=${DiscordProvider.client.user?.id}&permissions=0&scope=bot%20applications.commands)`;

        return makeInfoEmbed({
            title: `Invite`,
            description:
                message ||
                `${DiscordProvider.client.user?.username}'s invite is currently private. Only the developers can add me to another server`,
            user: data instanceof Interaction ? data.user : data.author
        });
    }
};

export default class Invite extends DiscordModule {
    public id: string = 'Discord_Invite';
    public commands = ['invite'];
    public commandInteractionName = 'invite';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.INVITE_INFO(data.getRaw())]
        });
    }
}
