import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import validator from 'validator';
import countryLookup from 'country-code-lookup';
import { countryCodeEmoji } from 'country-code-emoji';

import osuAPI from '../../providers/osuAPI';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';
import StringUtils from '../../utils/StringUtils';

const EMBEDS = {
    NO_USER_FOUND: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `That user doesn't exists on osu!`,
            user: data.getUser()
        });
    },
    NO_USER_MENTIONED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `No osu! username or user id provided`,
            user: data.getUser()
        });
    },
    INVALID_USER_MENTIONED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `Not a valid osu username or id`,
            user: data.getUser()
        });
    }
};

export default class osuUsers {
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

        if (!validator.isNumeric(user) && !this.validate_osu_username(user))
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.INVALID_USER_MENTIONED(data)]
            });

        let result = await osuAPI.client!.getUser({ u: user });

        if (result instanceof Array && result.length === 0)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_USER_FOUND(data)]
            });

        if (data.isApplicationCommand()) {
            await data.getSlashCommand().deferReply();
        }

        const level = {
            number: (Math.round((result.level + Number.EPSILON) * 100) / 100).toFixed(2).split('.')[0],
            progression: (Math.round((result.level + Number.EPSILON) * 100) / 100).toFixed(2).split('.')[1]
        };
        const embed = makeInfoEmbed({
            icon: '',
            title: `${countryCodeEmoji(result.country)}  ${result.name}`,
            //description: `${member.user.username}#${member.user.discriminator} (${member.user.id})`,
            fields: [
                {
                    name: `🏆  Level **${level.number}** (${level.progression}% progress to the next level)`,
                    value: `Play Count **${StringUtils.numberWithCommas(
                        result.counts.plays
                    )}**, totaling in **${StringUtils.numberWithCommas(
                        parseFloat(
                            (Math.round((result.secondsPlayed / (60 * 60) + Number.EPSILON) * 100) / 100).toFixed(2)
                        )
                    )} ${result.secondsPlayed < 60 ? 'hour' : 'hours'}** of songs played
                            \u200b`
                },
                {
                    name: '🌎  World Ranking',
                    value: `**#${StringUtils.numberWithCommas(result.pp.rank)}**`,
                    inline: true
                },
                {
                    name: `${countryCodeEmoji(result.country)}  Country Ranking`,
                    value: `**#${StringUtils.numberWithCommas(result.pp.countryRank)}** ${
                        countryLookup.byInternet(result.country)!.country
                    }`,
                    inline: true
                },
                {
                    name: '🎀  Total Score',
                    value: `**${StringUtils.numberWithCommas(result.scores.total)}**`,
                    inline: true
                },
                {
                    name: '✨  PP',
                    value: `**${StringUtils.numberWithCommas(result.pp.raw)}pp**`,
                    inline: true
                },
                {
                    name: '⭕  Hit Accuracy',
                    value: `**${result.accuracyFormatted}**`,
                    inline: true
                },
                {
                    name: '🌠  Ranked Score',
                    value: `**${StringUtils.numberWithCommas(result.scores.ranked)}**
                            \u200b`,
                    inline: true
                },
                {
                    name: '🥇  SSH',
                    value: `**${StringUtils.numberWithCommas(result.counts.SSH)}**`,
                    inline: true
                },
                {
                    name: '🥇  SH',
                    value: `**${StringUtils.numberWithCommas(result.counts.SH)}**`,
                    inline: true
                },
                {
                    name: '🥇  SS',
                    value: `**${StringUtils.numberWithCommas(result.counts.SS)}**`,
                    inline: true
                },
                {
                    name: '🥈  S',
                    value: `**${StringUtils.numberWithCommas(result.counts.S)}**`,
                    inline: true
                },
                {
                    name: '🥉  A',
                    value: `**${StringUtils.numberWithCommas(result.counts.A)}**`,
                    inline: true
                },
                {
                    name: '🏅  > A / Total plays',
                    value: `**${StringUtils.numberWithCommas(
                        result.counts.SSH + result.counts.SH + result.counts.SS + result.counts.S + result.counts.A
                    )}** (${(
                        Math.round(
                            ((result.counts.SSH +
                                result.counts.SH +
                                result.counts.SS +
                                result.counts.S +
                                result.counts.A) /
                                (result.counts.plays == 0 ? 1 : result.counts.plays) +
                                Number.EPSILON) *
                                10000
                        ) / 10000
                    ).toFixed(4)})
                            \u200b`,
                    inline: true
                },
                {
                    name: `❤  Account Information`,
                    value: `Joined: <t:${Math.round(
                        new Date(result.raw_joinDate).getTime() / 1000
                    )}:R>, <t:${Math.round(new Date(result.raw_joinDate).getTime() / 1000)}:f>`
                } //,
                /*{
                            name: `💌  Recent Events (Coming soon)`,
                            value: `*How about we explore the area ahead of us later?*`
                        }*/
            ],
            user: data.getUser()
        });
        embed.setAuthor({
            name: `${result.name}'s osu profile`,
            url: `https://osu.ppy.sh/users/${result.id}`,
            iconURL: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Osulogo.png'
        });

        // TODO: Fix for ppl with no image
        embed.setThumbnail(`https://a.ppy.sh/${result.id}` || 'https://osu.ppy.sh/images/layout/avatar-guest.png');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setEmoji('🔗')
                .setLabel('  Open Profile')
                .setURL(`https://osu.ppy.sh/users/${result.id}`)
                .setStyle(ButtonStyle.Link)
        ]);

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [embed],
            components: [row]
        });
    }

    // Criteria from https://github.com/ppy/osu-web/blob/9de00a0b874c56893d98261d558d78d76259d81b/app/Libraries/UsernameValidation.php
    private static validate_osu_username(username: string) {
        //username_no_spaces
        if (username.startsWith(' ') || username.endsWith(' ')) return false;

        //username_too_short
        if (username.length < 3) return false;

        //username_too_long
        if (username.length > 15) return false;

        //username_invalid_characters
        if (username.includes('  ') || !/^[A-Za-z0-9-\[\]_ ]+$/.test(username)) return false;

        //username_no_space_userscore_mix
        if (username.includes('_') && username.includes(' ')) return false;

        return true;
    }
}
