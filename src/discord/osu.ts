import {
    Message,
    ActionRowBuilder,
    ButtonBuilder,
    CommandInteraction,
    BaseInteraction,
    ButtonStyle
} from 'discord.js';
import validator from 'validator';
import countryLookup from 'country-code-lookup';
import { countryCodeEmoji } from 'country-code-emoji';

import Prisma from '../providers/Prisma';
import osuAPI from '../providers/osuAPI';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    sendHybridInteractionMessageResponse
} from '../utils/DiscordMessage';

const EMBEDS = {
    osu_INFO: (data: Message | BaseInteraction) => {
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
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    NO_USER_FOUND: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: `That user doesn't exists on osu!`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    NO_USER_MENTIONED: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: `No osu! username or user id provided`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    INVALID_USER_MENTIONED: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: `Not a valid osu username or id`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    INVALID_BEATMAP_ID_MENTIONED: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: `Not a valid osu beatmap id`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    NO_BEATMAP_FOUND: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: `That beatmap doesn't exists on osu!`,
            user: data instanceof BaseInteraction ? data.user : data.author
        });
    },
    NO_BEATMAP_MENTIONED: (data: Message | BaseInteraction) => {
        return makeErrorEmbed({
            title: `No osu! beatmap id provided`,
            user: data instanceof BaseInteraction ? data.user : data.author
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

        const funct = {
            user: async (data: HybridInteractionMessage) => {
                let user;
                if (data.isMessage()) {
                    if (typeof args[1] === 'undefined')
                        return await sendHybridInteractionMessageResponse(data, {
                            embeds: [EMBEDS.NO_USER_MENTIONED(data.getRaw())]
                        });
                    const [removed, ...newArgs] = args;
                    user = newArgs.join(' ');
                } else if (data.isApplicationCommand())
                    user = data.getSlashCommand().options.get('user')?.value?.toString();

                if (!validator.isNumeric(user) && !this.validate_osu_username(user))
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.INVALID_USER_MENTIONED(data.getRaw())]
                    });

                let result = await osuAPI.client.getUser({ u: user });

                if (result instanceof Array && result.length === 0)
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.NO_USER_FOUND(data.getRaw())]
                    });

                if (data.isApplicationCommand()) {
                    await data.getSlashCommand().deferReply();
                }

                const level = {
                    number: (Math.round((result.level + Number.EPSILON) * 100) / 100)
                        .toFixed(2)
                        .split('.')[0],
                    progression: (Math.round((result.level + Number.EPSILON) * 100) / 100)
                        .toFixed(2)
                        .split('.')[1]
                };
                const embed = makeInfoEmbed({
                    icon: '',
                    title: `${countryCodeEmoji(result.country)}  ${result.name}`,
                    //description: `${member.user.username}#${member.user.discriminator} (${member.user.id})`,
                    fields: [
                        {
                            name: `🏆  Level **${level.number}** (${level.progression}% progress to the next level)`,
                            value: `Play Count **${this.numberWithCommas(
                                result.counts.plays
                            )}**, totaling in **${this.numberWithCommas(
                                parseFloat(
                                    (
                                        Math.round(
                                            (result.secondsPlayed / (60 * 60) + Number.EPSILON) *
                                                100
                                        ) / 100
                                    ).toFixed(2)
                                )
                            )} ${result.secondsPlayed < 60 ? 'hour' : 'hours'}** of songs played
                            \u200b`
                        },
                        {
                            name: '🌎  World Ranking',
                            value: `**#${this.numberWithCommas(result.pp.rank)}**`,
                            inline: true
                        },
                        {
                            name: `${countryCodeEmoji(result.country)}  Country Ranking`,
                            value: `**#${this.numberWithCommas(result.pp.countryRank)}** ${
                                countryLookup.byInternet(result.country)!.country
                            }`,
                            inline: true
                        },
                        {
                            name: '🎀  Total Score',
                            value: `**${this.numberWithCommas(result.scores.total)}**`,
                            inline: true
                        },
                        {
                            name: '✨  PP',
                            value: `**${this.numberWithCommas(result.pp.raw)}pp**`,
                            inline: true
                        },
                        {
                            name: '⭕  Hit Accuracy',
                            value: `**${result.accuracyFormatted}**`,
                            inline: true
                        },
                        {
                            name: '🌠  Ranked Score',
                            value: `**${this.numberWithCommas(result.scores.ranked)}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: '🥇  SSH',
                            value: `**${this.numberWithCommas(result.counts.SSH)}**`,
                            inline: true
                        },
                        {
                            name: '🥇  SH',
                            value: `**${this.numberWithCommas(result.counts.SH)}**`,
                            inline: true
                        },
                        {
                            name: '🥇  SS',
                            value: `**${this.numberWithCommas(result.counts.SS)}**`,
                            inline: true
                        },
                        {
                            name: '🥈  S',
                            value: `**${this.numberWithCommas(result.counts.S)}**`,
                            inline: true
                        },
                        {
                            name: '🥉  A',
                            value: `**${this.numberWithCommas(result.counts.A)}**`,
                            inline: true
                        },
                        {
                            name: '🏅  > A / Total plays',
                            value: `**${this.numberWithCommas(
                                result.counts.SSH +
                                    result.counts.SH +
                                    result.counts.SS +
                                    result.counts.S +
                                    result.counts.A
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
                            )}:R>, <t:${Math.round(
                                new Date(result.raw_joinDate).getTime() / 1000
                            )}:f>`
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
                embed.setThumbnail(
                    `https://a.ppy.sh/${result.id}` ||
                        'https://osu.ppy.sh/images/layout/avatar-guest.png'
                );

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
            },
            beatmap: async (data: HybridInteractionMessage) => {
                let beatmap;
                if (data.isMessage()) {
                    if (typeof args[1] === 'undefined')
                        return await sendHybridInteractionMessageResponse(data, {
                            embeds: [EMBEDS.NO_BEATMAP_MENTIONED(data.getRaw())]
                        });
                    const [removed, ...newArgs] = args;
                    beatmap = newArgs.join(' ');
                } else if (data.isApplicationCommand())
                    beatmap = data.getSlashCommand().options.get('beatmap')?.value?.toString();

                if (!validator.isNumeric(beatmap))
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.INVALID_BEATMAP_ID_MENTIONED(data.getRaw())]
                    });

                let result = await osuAPI.client.getBeatmaps({ b: beatmap });

                if (result instanceof Array && result.length === 0)
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.NO_BEATMAP_FOUND(data.getRaw())]
                    });

                if (data.isApplicationCommand()) await data.getSlashCommand().deferReply();

                const bm_result = result[0];

                let url_mode = '#osu';
                let statusEmoji = '⚪';
                let mode: unknown = bm_result.mode;
                let status: unknown = bm_result.approvalStatus;

                if ((mode as String) === 'Taiko') url_mode = '#taiko';
                else if ((mode as String) === 'Catch the Beat') url_mode = '#fruits';
                else if ((mode as String) === 'Mania') url_mode = '#mania';

                if ((status as String) === 'Ranked') statusEmoji = '🏆';
                else if ((status as String) === 'Loved') statusEmoji = '❤';
                else if ((status as String) === 'Qualified') statusEmoji = '✅';
                else if ((status as String) === 'WIP') statusEmoji = '🛠';
                else if ((status as String) === 'Pending') statusEmoji = '⌛';
                else if ((status as String) === 'Graveyard') statusEmoji = '💀';

                const embed2 = makeInfoEmbed({
                    icon: '',
                    title: `${bm_result.title} - ${bm_result.artist}`,
                    fields: [
                        {
                            name: `Difficulty **[${bm_result.version}]**`,
                            value: `Mapper [${bm_result.creator}](${encodeURI(
                                'https://osu.ppy.sh/u/' + bm_result.creator
                            )})
                            Rating **${bm_result.rating.toFixed(2)}/10**
                            \u200b`
                        },
                        {
                            name: '⭐  Star Difficulty',
                            value: `**${(
                                Math.round((bm_result.difficulty.rating + Number.EPSILON) * 100) /
                                100
                            ).toFixed(2)}**`,
                            inline: true
                        },
                        {
                            name: `⌛ Length`,
                            value: `**${(
                                Math.round((bm_result.length.total / 60 + Number.EPSILON) * 100) /
                                100
                            )
                                .toFixed(2)
                                .replace('.', ':')}**`,
                            inline: true
                        },
                        {
                            name: '🏓  Combo',
                            value: `**${this.numberWithCommas(bm_result.maxCombo)}**`,
                            inline: true
                        },
                        {
                            name: '🕹  Mode',
                            value: `**${mode}**`,
                            inline: true
                        },
                        {
                            name: '🎵  BPM',
                            value: `**${bm_result.bpm}**`,
                            inline: true
                        },
                        {
                            name: `${statusEmoji}  Status`,
                            value: `**${bm_result.approvalStatus}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: '⭕  Circle',
                            value: `**${bm_result.objects.normal}**`,
                            inline: true
                        },
                        {
                            name: '💨  Slider',
                            value: `**${bm_result.objects.slider}**`,
                            inline: true
                        },
                        {
                            name: '💫  Spinner',
                            value: `**${bm_result.objects.spinner}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: `🎶  Track Information`,
                            value: `Language: **${bm_result.language}**
                            Genre: **${bm_result.genre}**
                            Submission Date: <t:${Math.round(
                                new Date(bm_result.raw_submitDate).getTime() / 1000
                            )}:R>, <t:${Math.round(
                                new Date(bm_result.raw_submitDate).getTime() / 1000
                            )}:f>
                            Last updated: <t:${Math.round(
                                new Date(bm_result.raw_lastUpdate).getTime() / 1000
                            )}:R>, <t:${Math.round(
                                new Date(bm_result.raw_lastUpdate).getTime() / 1000
                            )}:f>
                            Approved: <t:${Math.round(
                                new Date(bm_result.raw_approvedDate).getTime() / 1000
                            )}:R>, <t:${Math.round(
                                new Date(bm_result.raw_approvedDate).getTime() / 1000
                            )}:f>
                            \u200b`
                        },
                        {
                            name: '▶  Plays',
                            value: `**${this.numberWithCommas(bm_result.counts.plays)}**`,
                            inline: true
                        },
                        {
                            name: '🏁  Passes',
                            value: `**${this.numberWithCommas(bm_result.counts.passes)}**`,
                            inline: true
                        },
                        {
                            name: '♥  Favorites',
                            value: `**${this.numberWithCommas(bm_result.counts.favorites)}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: `📌  Tags`,
                            value: `\`\`${bm_result.tags.join(' ')}\`\``
                        }
                    ],
                    user: data.getUser()
                });

                embed2.setAuthor({
                    name: `osu! beatmap`,
                    url: `https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}${url_mode}/${bm_result.id}`,
                    iconURL: `https://upload.wikimedia.org/wikipedia/commons/e/e3/Osulogo.png`
                });
                embed2.setImage(
                    `https://assets.ppy.sh/beatmaps/${bm_result.beatmapSetId}/covers/cover.jpg`
                );

                const row = new ActionRowBuilder<ButtonBuilder>();
                if (bm_result.hasDownload)
                    row.addComponents([
                        new ButtonBuilder()
                            .setEmoji('🌎')
                            .setLabel('  Download (Beatconnect)')
                            .setURL(`https://beatconnect.io/b/${bm_result.beatmapSetId}/`)
                            .setStyle(ButtonStyle.Link),
                        new ButtonBuilder()
                            .setEmoji('🔗')
                            .setLabel('  Open listing')
                            .setURL(
                                `https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}${url_mode}/${bm_result.id}`
                            )
                            .setStyle(ButtonStyle.Link),
                        new ButtonBuilder()
                            .setEmoji('💬')
                            .setLabel('  Open discussion')
                            .setURL(
                                `https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}/discussion`
                            )
                            .setStyle(ButtonStyle.Link)
                    ]);

                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [embed2],
                    components: [row]
                });
            }
        };

        let query;

        if (data.isMessage()) {
            if (args.length === 0) {
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.osu_INFO(data.getRaw())]
                });
            }
            query = args[0].toLowerCase();
        } else if (data.isApplicationCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'user':
            case 'u':
                return await funct.user(data);
            case 'beatmap':
            case 'b':
                return await funct.beatmap(data);
        }
    }

    private numberWithCommas(x: Number) {
        try {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } catch (err) {
            return x;
        }
    }

    // Criteria from https://github.com/ppy/osu-web/blob/9de00a0b874c56893d98261d558d78d76259d81b/app/Libraries/UsernameValidation.php
    private validate_osu_username(username: string) {
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
