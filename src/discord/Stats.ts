import { I18n } from 'i18n';
import { Message, CommandInteraction, Interaction } from 'discord.js';
import os from 'os-utils';

import DiscordProvider from '../providers/Discord';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from '../utils/DiscordMessage';
import Locale from '../providers/Locale';
import Cache from '../providers/Cache';

const EMBEDS = {
    STATS_INFO: (data: Message | Interaction, locale: I18n) => {
        const totalServers = DiscordProvider.client.guilds.cache.size;
        const totalUsers = DiscordProvider.client.guilds.cache.map((g) => g.memberCount).reduce((a, c) => a + c);
        const systemUptime = Math.round(new Date().getTime() / 1000) - Math.round(os.sysUptime());
        const processUptime = Math.round(new Date().getTime() / 1000) - Math.round(os.processUptime());

        return makeInfoEmbed({
            title: locale.__('stats.title'),
            icon: '📊',
            description: locale.__('stats.description'),
            fields: [
                {
                    name: `🌐 ${locale.__('stats.users')}`,
                    value: `${locale.__('stats.x_servers', totalServers.toString())}\n${locale.__(
                        'stats.x_users',
                        totalUsers.toString()
                    )}`,
                    inline: true
                },
                {
                    name: `🟢 ${locale.__('stats.uptime_since')}`,
                    value: `${locale.__('stats.server_uptime_x', `<t:${systemUptime.toString()}:R>`)}\n${locale.__(
                        'stats.process_uptime_x',
                        `<t:${processUptime.toString()}:R>`
                    )}`,
                    inline: true
                }
            ],
            user: data instanceof Interaction ? data.user : data.author
        });
    }
};

export default class Stats extends DiscordModule {
    public id = 'Discord_Stats';
    public commands = ['stats'];
    public commandInteractionName = 'stats';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        if (!guild) return;

        const cachedGuild = await Cache.getCachedGuild(guild.id);
        if (!cachedGuild) return;

        const LocaleProvider = Locale.getLocaleProvider(cachedGuild.locale);

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.STATS_INFO(data.getRaw(), LocaleProvider)]
        });
    }
}
