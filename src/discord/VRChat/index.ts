import { Message, ActionRowBuilder, ButtonBuilder, CommandInteraction, BaseInteraction, ButtonStyle } from 'discord.js';
import validator from 'validator';
import { createHmac } from 'crypto';
import countryLookup from 'country-code-lookup';
import { countryCodeEmoji } from 'country-code-emoji';

import Prisma from '../../providers/Prisma';
import VRChatAPI from '../../providers/VRChatAPI';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';
import Environment from '../../providers/Environment';

import VRChatUser from './User';
import VRChatWorld from './World';

const EMBEDS = {
    VRChat_INFO: (data: HybridInteractionMessage) => {
        return makeInfoEmbed({
            title: 'VRChat',
            description: `[VRChat](https://hello.vrchat.com/) is an online virtual world platform created by Graham Gaylor and Jesse Joudrey and operated by VRChat, Inc. The platform allows users to interact with others with user-created 3D avatars and worlds.`,
            fields: [
                {
                    name: 'What can I do?',
                    value: 'You can view users stats and information'
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
            title: `VRChat feature is disabled`,
            user: data.getUser()
        });
    },
    ERROR: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `Something went wrong while connecting to VRChat`,
            user: data.getUser()
        });
    }
};

export default class VRChat extends DiscordModule {
    public id = 'Discord_VRChat';
    public commands = ['vrchat', 'vrc'];
    public commandInteractionName = 'vrchat';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const Guild = await Prisma.client.guild.findFirst({ where: { id: data.getGuild()!.id } });
        if (!Guild) return;

        if (!VRChatAPI.isReady())
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NOT_INITIALIZED(data)]
            });

        let query;

        if (data.isMessage()) {
            if (args.length === 0) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.VRChat_INFO(data)]
                });
            }
            query = args[0].toLowerCase();
        } else if (data.isApplicationCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'user':
            case 'u':
                return await VRChatUser.run(data, args);
            case 'world':
            case 'w':
                return await VRChatWorld.run(data, args);
        }
    }

    private numberWithCommas(x: Number) {
        try {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } catch (err) {
            return x;
        }
    }
}
