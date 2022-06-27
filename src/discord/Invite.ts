import { Message, CommandInteraction, Interaction } from 'discord.js';
import { I18n } from 'i18n';

import Environment from '../providers/Environment';
import DiscordProvider from '../providers/Discord';
import Users from '../services/Users';
import Locale from '../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from '../utils/DiscordMessage';

const EMBEDS = {
    INVITE_INFO: (data: HybridInteractionMessage, locale: I18n) => {
        const user = data.getUser();
        let message;
        if (!Environment.get().PRIVATE_BOT || user != null && Users.isDeveloper(user.id))
            message = locale.__('invite.info', { BOT_NAME: DiscordProvider.client.user!.username, LINK: `https://discord.com/api/oauth2/authorize?client_id=${DiscordProvider.client.user?.id}&permissions=0&scope=bot%20applications.commands`});

        return makeInfoEmbed({
            title: `Invite`,
            description: message || locale.__('invite.private', { BOT_NAME: DiscordProvider.client.user!.username}),
            user
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
        const guild = data.getGuild();
        if (!guild) return;

        const locale = await Locale.getGuildLocale(guild.id);

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.INVITE_INFO(data, locale)]
        });
    }
}
