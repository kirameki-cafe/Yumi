import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import validator from 'validator';

import osuAPI from '../../providers/osuAPI';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from '../../utils/DiscordMessage';
import StringUtils from '../../utils/StringUtils';

const EMBEDS = {
    INVALID_BEATMAP_ID_MENTIONED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `Not a valid osu beatmap id`,
            user: data.getUser()
        });
    },
    NO_BEATMAP_FOUND: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `That beatmap doesn't exists on osu!`,
            user: data.getUser()
        });
    },
    NO_BEATMAP_MENTIONED: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: `No osu! beatmap id provided`,
            user: data.getUser()
        });
    }
};

export default class osuBeatmaps {
    public static async run(data: HybridInteractionMessage, args: any) {
        let beatmap;
        if (data.isMessage()) {
            if (typeof args[1] === 'undefined')
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.NO_BEATMAP_MENTIONED(data)]
                });
            const [removed, ...newArgs] = args;
            beatmap = newArgs.join(' ');
        } else if (data.isApplicationCommand())
            beatmap = data.getSlashCommand().options.get('beatmap')?.value?.toString();

        if (!validator.isNumeric(beatmap))
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.INVALID_BEATMAP_ID_MENTIONED(data)]
            });

        let result = await osuAPI.client!.getBeatmaps({ b: beatmap });

        if (result instanceof Array && result.length === 0)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NO_BEATMAP_FOUND(data)]
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
                    value: `Mapper [${bm_result.creator}](${encodeURI('https://osu.ppy.sh/u/' + bm_result.creator)})
                            Rating **${bm_result.rating.toFixed(2)}/10**
                            \u200b`
                },
                {
                    name: '⭐  Star Difficulty',
                    value: `**${(Math.round((bm_result.difficulty.rating + Number.EPSILON) * 100) / 100).toFixed(2)}**`,
                    inline: true
                },
                {
                    name: `⌛ Length`,
                    value: `**${(Math.round((bm_result.length.total / 60 + Number.EPSILON) * 100) / 100)
                        .toFixed(2)
                        .replace('.', ':')}**`,
                    inline: true
                },
                {
                    name: '🏓  Combo',
                    value: `**${StringUtils.numberWithCommas(bm_result.maxCombo)}**`,
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
                            )}:R>, <t:${Math.round(new Date(bm_result.raw_submitDate).getTime() / 1000)}:f>
                            Last updated: <t:${Math.round(
                                new Date(bm_result.raw_lastUpdate).getTime() / 1000
                            )}:R>, <t:${Math.round(new Date(bm_result.raw_lastUpdate).getTime() / 1000)}:f>
                            Approved: <t:${Math.round(
                                new Date(bm_result.raw_approvedDate).getTime() / 1000
                            )}:R>, <t:${Math.round(new Date(bm_result.raw_approvedDate).getTime() / 1000)}:f>
                            \u200b`
                },
                {
                    name: '▶  Plays',
                    value: `**${StringUtils.numberWithCommas(bm_result.counts.plays)}**`,
                    inline: true
                },
                {
                    name: '🏁  Passes',
                    value: `**${StringUtils.numberWithCommas(bm_result.counts.passes)}**`,
                    inline: true
                },
                {
                    name: '♥  Favorites',
                    value: `**${StringUtils.numberWithCommas(bm_result.counts.favorites)}**
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
        embed2.setImage(`https://assets.ppy.sh/beatmaps/${bm_result.beatmapSetId}/covers/cover.jpg`);

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
                    .setURL(`https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}${url_mode}/${bm_result.id}`)
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setEmoji('💬')
                    .setLabel('  Open discussion')
                    .setURL(`https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}/discussion`)
                    .setStyle(ButtonStyle.Link)
            ]);

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [embed2],
            components: [row]
        });
    }
}
