import { Message, CommandInteraction } from 'discord.js';

import Prisma from '../../providers/Prisma';
import osuAPI from '../../providers/osuAPI';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';

import osuUsers from './Users';
import osuBeatmaps from './Beatmaps';

const EMBEDS = {
    osu_INFO: (data: HybridInteractionMessage) => {
        return makeInfoEmbed({
            title: 'osu!',
            description: `[osu!](https://osu.ppy.sh/home) is a free-to-play rhythm game primarily developed, published, and created by Dean "peppy" Herbert`,
            fields: [
                {
                    name: 'What can I do?',
                    value: 'You can view users or beatmaps stats and information'
                },
                {
                    name: 'Available arguments',
                    value: '``user``'
                }
            ],
            user: data.getUser()
        });
    },
    NOT_INITIALIZED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `osu! feature is disabled`,
            user: data.getUser()
        });
    }
};

export default class osu extends DiscordModule {
    public id = 'Discord_osu';
    public commands = ['osu'];
    public commandInteractionName = 'osu';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const Guild = await Prisma.client.guild.findFirst({ where: { id: data.getGuild()!.id } });
        if (!Guild) return;

        if (!osuAPI.client)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NOT_INITIALIZED(data)]
            });

        let query;
        if (data.isMessage()) {
            if (args.length === 0) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.osu_INFO(data)]
                });
            }
            query = args[0].toLowerCase();
        } else if (data.isApplicationCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'user':
            case 'u':
                return await osuUsers.run(data, args);
            case 'beatmap':
            case 'b':
                return await osuBeatmaps.run(data, args);
        }
    }
}
