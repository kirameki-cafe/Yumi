import { Message, ActionRowBuilder, ButtonBuilder, CommandInteraction, BaseInteraction, ButtonStyle } from 'discord.js';

import Prisma from '../../providers/Prisma';
import VRChatAPI from '../../providers/VRChatAPI';
import validator from 'validator';
import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';
import Environment from '../../providers/Environment';
import ImagePorxy from '../../libs/ImageProxy';

const EMBEDS = {
    NO_USER_FOUND: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `That user doesn't exists on VRChat`,
            user: data.getUser()
        });
    },
    NO_USER_MENTIONED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `No VRChat username or user id provided`,
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

export default class VRChatUser {
    public static async run(data: HybridInteractionMessage, args: any) {
        let user;
        if (data.isMessage()) {
            if (typeof args[1] === 'undefined')
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_USER_MENTIONED(data)]
                });
            const [removed, ...newArgs] = args;
            user = newArgs.join(' ');
        } else if (data.isApplicationCommand()) user = data.getSlashCommand().options.get('user')?.value?.toString();

        let result;

        try {
            if (user.startsWith('usr_')) result = await VRChatAPI.client!.UsersApi.getUser(user);
            else {
                let search_result = await VRChatAPI.client!.UsersApi.searchUsers(user, undefined, 100);
                if (search_result.data.length === 0)
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.NO_USER_FOUND(data)]
                    });

                let foundExact = false;
                for (let i = 0; i < search_result.data.length; i++) {
                    if (search_result.data[i].displayName.toLowerCase() === user.toLowerCase()) {
                        result = await VRChatAPI.client!.UsersApi.getUser(search_result.data[i].id);
                        foundExact = true;
                        break;
                    }
                }

                if (!foundExact) result = await VRChatAPI.client!.UsersApi.getUser(search_result.data[0].id);
            }
        } catch (err: any) {
            // If 404
            if (err.response?.status === 404)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_USER_FOUND(data)]
                });
            else
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.ERROR(data)]
                });
        }

        if (!result)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_USER_FOUND(data)]
            });

        if (data.isApplicationCommand()) {
            await data.getSlashCommand().deferReply();
        }

        const embed = makeInfoEmbed({
            icon: null,
            title: `**${result.data.displayName}**`,
            description: `**${
                result.data.isFriend ? `${this.getState(result.data.status, result.data.state)}` : `⚪  Unknown`
            }**\n\u200b`,
            fields: [
                {
                    name: `${this.getTrustRankEmoji(result.data.tags)}  ${this.getTrustRank(
                        result.data.tags
                    )}${this.getExtraRanks(result.data.tags)}`,
                    value: `\u200b`,
                    inline: false
                },
                {
                    name: '✨  Status',
                    value: `${result.data.statusDescription || 'None'}\n\u200b`,
                    inline: true
                },
                {
                    name: '🌏  Language',
                    value: `${this.listLanguages(result.data.tags)}\n\u200b`,
                    inline: true
                },
                {
                    name: '✨  Bio',
                    value: `${result.data.bio}\n\u200b`
                },
                {
                    name: `❤  Account Information`,
                    value: `Joined: <t:${Math.round(
                        new Date(result.data.date_joined).getTime() / 1000
                    )}:R>, <t:${Math.round(new Date(result.data.date_joined).getTime() / 1000)}:f>
                            Avatar Cloning: ${result.data.allowAvatarCopying ? 'Enabled' : 'Disabled'}
                            User ID: \`\`${result.data.id}\`\`\n`
                }
            ],
            user: data.getUser()
        });
        embed.setAuthor({
            name: `VRChat Profile`,
            url: `https://vrchat.com/home/user/${result.data.id}`,
            iconURL:
                'https://www.theladders.com/s3proxy/company-photo.theladders.com/68949/5721f0dd-d662-4b5e-9c0b-236b8a41b0d3.png'
        });

        let userMainImage;

        if (result.data.userIcon) userMainImage = result.data.userIcon;
        else if (result.data.currentAvatarImageUrl) userMainImage = result.data.currentAvatarImageUrl;

        if (userMainImage)
            embed.setThumbnail(
                ImagePorxy.signImageProxyURL(userMainImage, 'resize:fill:150:150:0') ||
                    'https://osu.ppy.sh/images/layout/avatar-guest.png'
            );

        if (result.data.profilePicOverride)
            embed.setImage(
                ImagePorxy.signImageProxyURL(result.data.profilePicOverride, 'resize:fill:960:540:0') ||
                    'https://osu.ppy.sh/images/layout/avatar-guest.png'
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setEmoji('🔗')
                .setLabel('  Open Profile')
                .setURL(`https://vrchat.com/home/user/${result.data.id}`)
                .setStyle(ButtonStyle.Link)
        ]);

        for (let link of result.data.bioLinks) {
            this.parseBioLink(row, link);
        }

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [embed],
            components: [row]
        });
    }
    private static getState(status: string, state: string) {
        if (state === 'offline') return '⚪  Offline';
        else if (state === 'active') return '🟡  Active (Web/API)';

        switch (status) {
            case 'join me':
                return '🔵  Join Me';
            case 'active':
                return '🟢  Online';
            case 'ask me':
                return '🟠  Ask Me';
            case 'busy':
                return '🔴  Do Not Disturb';
            case 'offline':
                return '⚪  Offline';
            default:
                return '⚪  Unknown';
        }
    }

    private static getTrustRank(tags: string[]) {
        /*
            Trusted user - system_trust_veteran
            Known user - system_trust_trusted
            User - system_trust_known
            New user - system_trust_basic
            Visitor - (No above tags) (or system_no_captcha?)
        */
        if (tags.includes('system_trust_veteran')) return 'Trusted User';
        if (tags.includes('system_trust_trusted')) return 'Known User';
        if (tags.includes('system_trust_known')) return 'User';
        if (tags.includes('system_trust_basic')) return 'New User';
        return 'Visitor';
    }

    private static getExtraRanks(tags: string[]) {
        let ranks = '';
        if (tags.includes('system_probable_troll')) ranks += ' [Nuisance]';
        if (tags.includes('admin_moderator') || tags.includes('admin_scripting_access')) ranks += ' [VRChat Team]';

        return ranks;
    }

    private static getTrustRankEmoji(tags: string[]) {
        if (tags.includes('system_probable_troll')) return '🚩';
        if (tags.includes('admin_moderator') || tags.includes('admin_scripting_access')) return '❤️';

        if (tags.includes('system_trust_veteran')) return '💜';
        if (tags.includes('system_trust_trusted')) return '🧡';
        if (tags.includes('system_trust_known')) return '💚';
        if (tags.includes('system_trust_basic')) return '💙';
        return '🤍';
    }

    private static remapLanguageToISO3166(language: string) {
        const map: any = {
            eng: 'en',
            kor: 'ko',
            rus: 'ru',
            spa: 'es',
            por: 'pt',
            zho: 'zh',
            deu: 'de',
            jpn: 'ja',
            fra: 'fr',
            swe: 'sv',
            nld: 'nl',
            pol: 'pl',
            dan: 'da',
            nor: 'no',
            ita: 'it',
            tha: 'th',
            fin: 'fi',
            hun: 'hu',
            ces: 'cs',
            tur: 'tr',
            ara: 'ar',
            ron: 'ro',
            vie: 'vi',
            ukr: 'uk'
        };
        return map[language] || language;
    }

    private static listLanguages(tags: string[]) {
        const languages = tags.filter((tag) => tag.startsWith('language_'));
        const languagesWithoutPrefix = languages.map((language) => language.replace('language_', ''));

        let finalLang = [];
        for (let lang of languagesWithoutPrefix) {
            //finalLang.push(`${countryCodeEmoji(this.remapLanguageToISO3166(lang))} ${lang}`);
            finalLang.push(`${lang}`);
        }

        return finalLang.join(', ');
    }

    private static parseBioLink(row: any, link: string) {
        const links: any = {
            'twitter.com': { emoji: '🐦', label: 'Twitter' },
            'youtube.com': { emoji: '📺', label: 'YouTube' },
            'twitch.tv': { emoji: '📺', label: 'Twitch' },
            'instagram.com': { emoji: '📷', label: 'Instagram' },
            'facebook.com': { emoji: '📷', label: 'Facebook' },
            'discord.gg': { emoji: '📢', label: 'Discord' },
            'discord.com': { emoji: '📢', label: 'Discord' },
            'reddit.com': { emoji: '📰', label: 'Reddit' },
            'github.com': { emoji: '📦', label: 'GitHub' },
            'steamcommunity.com': { emoji: '🎮', label: 'Steam' },
            'tiktok.com': { emoji: '🎮', label: 'TikTok' },
            'patreon.com': { emoji: '💰', label: 'Patreon' },
            'ko-fi.com': { emoji: '☕', label: 'Ko-Fi' },
            'paypal.me': { emoji: '💳', label: 'PayPal' },
            'paypal.com': { emoji: '💳', label: 'PayPal' }
        };

        // Check if valid url using validator
        if (!validator.isURL(link)) return;

        const domain = new URL(link).hostname.toLowerCase();

        if (links[domain]) {
            row.addComponents([
                new ButtonBuilder()
                    .setEmoji(links[domain].emoji)
                    .setLabel(`  ${links[domain].label}`)
                    .setStyle(ButtonStyle.Link)
                    .setURL(link)
            ]);
        } else {
            row.addComponents([
                new ButtonBuilder().setEmoji('🔗').setLabel('  Bio Link').setURL(link).setStyle(ButtonStyle.Link)
            ]);
        }
    }
}
