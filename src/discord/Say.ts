import { Message, Permissions, Interaction, CommandInteraction } from 'discord.js';
import { I18n } from 'i18n';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import {
    makeSuccessEmbed,
    sendHybridInteractionMessageResponse,
    makeErrorEmbed,
    makeInfoEmbed
} from '../utils/DiscordMessage';
import Locale from '../services/Locale';

const EMBEDS = {
    SAY_INFO: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('say.title'),
            description: locale.__('say.info'),
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('say.valid_args')
                }
            ],
            user: data.getUser()
        });
    },
    NO_PERMISSION: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('common.no_permissions'),
            description: locale.__(
                'common.no_permissions_description',
                'VIEW_CHANNEL, SEND_MESSAGES and MANAGE_CHANNELS'
            ),
            user: data.getUser()
        });
    },
    SAY_ERROR: (data: HybridInteractionMessage, locale: I18n, error: Error) => {
        return makeErrorEmbed({
            title: locale.__('say.error'),
            description: error.message ? error.message : undefined,
            user: data.getUser()
        });
    },
    SUCCESSFULLY_SAID: (data: HybridInteractionMessage, locale: I18n) => {
        return makeSuccessEmbed({
            title: locale.__('say.success'),
            user: data.getUser()
        });
    }
};

export default class Say extends DiscordModule {
    public id = 'Discord_Say';
    public commands = ['say'];
    public commandInteractionName = 'say';

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
            const message = data.getMessage();

            if (!message.member) return;

            if (
                !message.member.permissions.has([
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                    Permissions.FLAGS.MANAGE_CHANNELS
                ])
            )
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_PERMISSION(data, locale)]
                });

            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.SAY_INFO(data, locale)]
                });

            query = args.join(' ');
        } else if (data.isSlashCommand()) {
            const interaction = data.getSlashCommand();
            if (
                !data
                    .getGuild()!
                    .members.cache.get(interaction.user.id)
                    ?.permissions.has([Permissions.FLAGS.ADMINISTRATOR])
            )
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_PERMISSION(data, locale)]
                });

            query = interaction.options.getString('message');
        }

        if (data.isSlashCommand() && data.getChannel()) {
            try {
                await data.getChannel()!.send({ content: query });
                await data
                    .getMessageComponentInteraction()
                    .reply({ ephemeral: true, embeds: [EMBEDS.SUCCESSFULLY_SAID(data, locale)] });
            } catch (err: any) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.SAY_ERROR(data, locale, err)]
                });
            }
        } else if (data.isMessage()) {
            const message = data.getMessage();
            if (message.deletable) await message.delete();

            try {
                await data.getChannel()!.send({ content: query });
            } catch (err: any) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.SAY_ERROR(data, locale, err)]
                });
            }
        }
    }
}
