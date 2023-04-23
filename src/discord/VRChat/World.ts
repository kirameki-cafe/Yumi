import { Message, ActionRowBuilder, ButtonBuilder, CommandInteraction, BaseInteraction, ButtonStyle } from 'discord.js';

import Prisma from '../../providers/Prisma';
import VRChatAPI from '../../providers/VRChatAPI';
import validator from 'validator';
import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';
import Environment from '../../providers/Environment';
import ImagePorxy from '../../libs/ImageProxy';
import * as VRChat from 'vrchat';

const EMBEDS = {
    NO_WORLD_FOUND: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `That world doesn't exists on VRChat`,
            user: data.getUser()
        });
    },
    NO_WORLD_MENTIONED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `No VRChat world name or world id provided`,
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

export default class VRChatWorld {
    public static async run(data: HybridInteractionMessage, args: any) {
        let world;
        if (data.isMessage()) {
            if (typeof args[1] === 'undefined')
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_WORLD_MENTIONED(data)]
                });
            const [removed, ...newArgs] = args;
            world = newArgs.join(' ');
        } else if (data.isApplicationCommand()) world = data.getSlashCommand().options.get('world')?.value?.toString();

        let result;

        try {
            if (world.startsWith('wrld_')) result = await VRChatAPI.client!.WorldsApi.getWorld(world);
            else {
                let search_result = await VRChatAPI.client!.WorldsApi.searchWorlds(
                    undefined,
                    VRChat.SortOption.Relevance,
                    undefined,
                    undefined,
                    100,
                    undefined, //VRChat.OrderOption.Descending,
                    undefined,
                    world
                );
                if (search_result.data.length === 0)
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.NO_WORLD_FOUND(data)]
                    });

                let foundExact = false;
                for (let i = 0; i < search_result.data.length; i++) {
                    if (search_result.data[i].name.toLowerCase() === world.toLowerCase()) {
                        result = await VRChatAPI.client!.WorldsApi.getWorld(search_result.data[i].id);
                        foundExact = true;
                        break;
                    }
                }

                if (!foundExact) result = await VRChatAPI.client!.WorldsApi.getWorld(search_result.data[0].id);
            }
        } catch (err: any) {
            if (err.response?.status === 404)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_WORLD_FOUND(data)]
                });
            else
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.ERROR(data)]
                });
        }

        if (!result)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_WORLD_FOUND(data)]
            });

        if (data.isApplicationCommand()) {
            await data.getSlashCommand().deferReply();
        }

        let author = await VRChatAPI.client!.UsersApi.getUser(result.data.authorId);

        const embed = makeInfoEmbed({
            icon: null,
            title: `**${result.data.name}**`,
            description: `Created by **[${result.data.authorName}](https://vrchat.com/home/user/${author.data.id})**\n\u200b`,
            fields: [
                {
                    name: '🌎  World Description',
                    value: `${result.data.description}\n\u200b`,
                    inline: false
                },
                {
                    name: `${this.getReleaseStatusEmoji(result.data)} Visiblity`,
                    value: `${this.getReleaseStatus(result.data)}\n\u200b`,
                    inline: true
                },
                {
                    name: '✨  Visits',
                    value: `${this.numberWithCommas(result.data.visits)}\n\u200b`,
                    inline: true
                },
                {
                    name: '💕  Favorites',
                    value: `${result.data.favorites ? this.numberWithCommas(result.data.favorites) : 0}\n\u200b`,
                    inline: true
                },
                {
                    name: '👥  Players',
                    value: `${result.data.occupants ? this.numberWithCommas(result.data.occupants) : 0} ${
                        result.data.instances
                            ? `(${this.numberWithCommas(
                                  result.data.publicOccupants || 0
                              )} public, ${this.numberWithCommas(result.data.privateOccupants || 0)} private)`
                            : ''
                    }\n\u200b`,
                    inline: true
                },
                {
                    name: '💖  Popularity',
                    value: `${this.numberWithCommas(result.data.popularity)}\n\u200b`,
                    inline: true
                },
                {
                    name: '🔥  Heat',
                    value: `${result.data.heat}\n\u200b`,
                    inline: true
                },
                {
                    name: '📥 Capacity',
                    value: `${result.data.capacity}\n\u200b`,
                    inline: true
                },
                {
                    name: '📅 Last updated',
                    value: `<t:${Math.round(new Date(result.data.updated_at).getTime() / 1000)}:R>\n<t:${Math.round(
                        new Date(result.data.updated_at).getTime() / 1000
                    )}:f>\n\u200b`,
                    inline: true
                },
                {
                    name: '📅 Created at',
                    value: `<t:${Math.round(new Date(result.data.created_at).getTime() / 1000)}:R>\n<t:${Math.round(
                        new Date(result.data.created_at).getTime() / 1000
                    )}:f>\n\u200b`,
                    inline: true
                },
                {
                    name: `❤  World Information`,
                    value: `World ID: \`\`${result.data.id}\`\`\nCreator ID: \`\`${result.data.authorId}\`\`\n`
                }
            ],
            user: data.getUser()
        });

        embed.setAuthor({
            name: `VRChat World`,
            url: `https://vrchat.com/home/world/${result.data.id}`,
            iconURL:
                'https://www.theladders.com/s3proxy/company-photo.theladders.com/68949/5721f0dd-d662-4b5e-9c0b-236b8a41b0d3.png'
        });

        let mainImage;

        if (result.data.thumbnailImageUrl) mainImage = result.data.thumbnailImageUrl;

        if (mainImage)
            embed.setImage(
                ImagePorxy.signImageProxyURL(mainImage, 'resize:fill:960:540:0') ||
                    'https://osu.ppy.sh/images/layout/avatar-guest.png'
            );

        let userMainImage;

        if (author.data.userIcon) userMainImage = author.data.userIcon;
        else if (author.data.currentAvatarImageUrl) userMainImage = author.data.currentAvatarImageUrl;

        if (userMainImage)
            embed.setThumbnail(
                ImagePorxy.signImageProxyURL(userMainImage, 'resize:fill:150:150:0') ||
                    'https://osu.ppy.sh/images/layout/avatar-guest.png'
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setEmoji('🔗')
                .setLabel('  Open World')
                .setURL(`https://vrchat.com/home/world/${result.data.id}`)
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setEmoji('🔗')
                .setLabel(`  ${author.data.displayName}'s Profile`)
                .setURL(`https://vrchat.com/home/user/${author.data.id}`)
                .setStyle(ButtonStyle.Link)
        ]);

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [embed],
            components: [row]
        });
    }

    private static numberWithCommas(x: Number) {
        try {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } catch (err) {
            return x;
        }
    }

    private static getReleaseStatusEmoji(world: any) {
        switch (world.releaseStatus) {
            case 'public':
                if (world.tags.includes('system_labs')) return '🧪';
                else return '🌎';
            case 'private':
                return '🔒';
            default:
                return '🌎';
        }
    }

    private static getReleaseStatus(world: any) {
        switch (world.releaseStatus) {
            case 'public':
                if (world.tags.includes('system_labs')) return 'Labs';
                else return 'Public';
            case 'private':
                return 'Private';
            default:
                return world.releaseStatus;
        }
    }
}
