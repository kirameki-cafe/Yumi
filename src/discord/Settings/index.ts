import {
    Message,
    Interaction,
    CommandInteraction,
    Permissions,
    ThreadChannel,
    GuildChannel,
    Guild
} from 'discord.js';
import { I18n } from 'i18n';

import DiscordProvider from '../../providers/Discord';
import Prisma from '../../providers/Prisma';
import Cache from '../../providers/Cache';
import Locale from '../../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    makeSuccessEmbed,
    makeProcessingEmbed,
    sendHybridInteractionMessageResponse
} from '../../utils/DiscordMessage';

import * as PrefixModule from './Prefix';
import * as ServiceAnnouncementModule from './ServiceAnnouncement';

export const COMMON_EMBEDS = {
    NO_PERMISSION: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('common.no_permissions'),
            description: locale.__('common.no_permissions_description', { PERMISSIONS: 'ADMINISTRATOR'}),
            user: data.getUser()
        });
    },
    PROCESSING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeProcessingEmbed({
            icon: data.isMessage() ? undefined : '⌛',
            title: locale.__('common.processing'),
            user: data.getUser()
        });
    }
}

const EMBEDS = {
    SETTINGS_INFO: (data: HybridInteractionMessage, locale: I18n, guild: Guild) => {
        return makeInfoEmbed({
            title: locale.__('settings.title'),
            description: locale.__('settings.description', {
                BOT_NAME: DiscordProvider.client.user!.username,
                GUILD_NAME: guild.name
            }),
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('settings.valid_args'),
                }
            ],
            user: data.getUser()
        });
    }
};

export default class Settings extends DiscordModule {
    public id = 'Discord_Settings';
    public commands = ['settings'];
    public commandInteractionName = 'settings';

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

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.SETTINGS_INFO(data, locale, guild)]
                });

            query = args[0].toLowerCase();
        } else if (data.isSlashCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'info':
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.SETTINGS_INFO(data, locale, guild)]
                });
            case 'prefix':
                return await PrefixModule.default(data, args, guild, locale);
            case 'enableserviceannouncement':
                return await ServiceAnnouncementModule.setEnableServiceAnnouncement(data, args, guild, locale);
            case 'serviceannouncementchannel':
                return await ServiceAnnouncementModule.setServiceAnnouncementChannel(data, args, guild, locale);
        }
    }
}
