import { Message, CommandInteraction, Interaction } from 'discord.js';
import os from 'os-utils';

import DiscordProvider from '../providers/Discord';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from '../utils/DiscordMessage';

const EMBEDS = {
    STATS_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: `Stats`,
            icon: '📊',
            description: 'Stats of the bot',
            fields: [
                {
                    name: '🌐 Users',
                    value: `${
                        DiscordProvider.client.guilds.cache.size
                    } servers\n${DiscordProvider.client.guilds.cache
                        .map((g) => g.memberCount)
                        .reduce((a, c) => a + c)} users`,
                    inline: true
                },
                {
                    name: '🟢 Uptime since',
                    value: `System: <t:${
                        Math.round(new Date().getTime() / 1000) - Math.round(os.sysUptime())
                    }:R>\nProcess: <t:${
                        Math.round(new Date().getTime() / 1000) - Math.round(os.processUptime())
                    }:R>`,
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
        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.STATS_INFO(data.getRaw())]
        });
    }
}
