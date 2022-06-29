import { Message, CommandInteraction } from 'discord.js';
import { I18n } from 'i18n';

import Environment from '../providers/Environment';
import DiscordProvider from '../providers/Discord';
import Locale from '../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from '../utils/DiscordMessage';

const EMBEDS = {
    SUPPORT_INFO: (data: HybridInteractionMessage, locale: I18n) => {
        const user = data.getUser();
        let message;
        if (Environment.get().SUPPORT_URL)
            message = locale.__('support.info', { BOT_NAME: DiscordProvider.client.user!.username, LINK: Environment.get().SUPPORT_URL});

        return makeInfoEmbed({
            title: locale.__('support.title'),
            description: message || locale.__('support.not_available', { BOT_NAME: DiscordProvider.client.user!.username}),
            user
        });
    }
};

export default class Support extends DiscordModule {
    public id: string = 'Discord_Support';
    public commands = ['support'];
    public commandInteractionName = 'support';

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

        await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.SUPPORT_INFO(data, locale)]
        });

        if(Environment.get().SUPPORT_URL)
            await sendHybridInteractionMessageResponse(data, {
                content: Environment.get().SUPPORT_URL
            });
    }
}
