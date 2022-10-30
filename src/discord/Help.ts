import { CommandInteraction, Message } from 'discord.js';
import { I18n } from 'i18n';

import DiscordProvider from '../providers/Discord';
import Cache from '../providers/Cache';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from '../utils/DiscordMessage';
import Locale from '../services/Locale';
import { Guild as PrismaGuild } from '@prisma/client';

const EMBEDS = {
    INFO: async (data: HybridInteractionMessage, locale: I18n, GuildCache: PrismaGuild) => {
        let prefix = GuildCache.prefix;
        const bot = DiscordProvider.client.user!;

        let _e = makeInfoEmbed({
            icon: '💌',
            title: locale.__('help.title', { BOT_NAME: bot.username }),
            description: `\u200b\n🏷️ **${locale.__('help.prefix_title')}**\n${locale.__(
                'help.prefix_description',
                {PREFIX: prefix.replaceAll('`', '`​'), PREFIX_MENTION: `<@${bot.id}>`}
            )}\n\n💻 **${locale.__('help.available_commands')}**`,
            fields: [
                {
                    name: `☕ ${locale.__('help.general')}`,
                    value: `help, ping, invite, userinfo, stats, support`,
                    inline: true
                },
                {
                    name: `🎮 ${locale.__('help.games')}`,
                    value: `osu`,
                    inline: true
                },
                {
                    name: `🎵 ${locale.__('help.music')}`,
                    value: `play (p), playmy, search, skip, pause, resume, queue (q), nowplaying (np), repeat (loop), summon (join), disconnect (leave, dc)`,
                    inline: true
                },
                {
                    name: `🔐 ${locale.__('help.admin')}`,
                    value: `settings, say, membershipscreening (ms)`,
                    inline: true
                },
                {
                    name: `🔧 ${locale.__('help.developer')}`,
                    value: 'debug, interactions, serviceannouncement',
                    inline: true
                },
                {
                    name: '\u200b',
                    value: `**${locale.__('help.footer')}(https://github.com/kirameki-cafe/Yumi)**`,
                    inline: false
                }
            ],
            user: data.getUser()
        });
        _e.setThumbnail(`${DiscordProvider.client.user?.displayAvatarURL()}?size=4096`);
        return _e;
    }
};

export default class Help extends DiscordModule {
    public id = 'Discord_Help';
    public commands = ['help'];
    public commandInteractionName = 'help';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        const member = data.getMember();

        if (!guild || !member) return;

        const GuildCache = await Cache.getCachedGuild(guild.id);
        if (!GuildCache) return;

        const locale = await Locale.getGuildLocale(guild.id);

        const message = await sendHybridInteractionMessageResponse(data, {
            embeds: [await EMBEDS.INFO(data, locale, GuildCache)]
        });

        if (message && data.isMessage()) return new HybridInteractionMessage(message).getMessage().react('♥');
    }
}
