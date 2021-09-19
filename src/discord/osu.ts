import { GuildChannel, GuildMember, Message, Permissions, TextChannel, MessageActionRow, MessageButton, Interaction, CommandInteraction, Role, ThreadChannel } from "discord.js";
import App from "..";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, makeInfoEmbed, makeErrorEmbed, sendMessage, sendReply, sendMessageOrInteractionResponse } from "../utils/DiscordMessage";
import Logger from "../libs/Logger";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";
import osuAPI from "../providers/osuAPI";
import { countryCodeEmoji, emojiCountryCode } from "country-code-emoji";
import countryLookup from "country-code-lookup";
import validator from 'validator';

const EMBEDS = {
    osu_INFO:(data: Message | Interaction) => {
        return makeInfoEmbed ({
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
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_USER_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: `That user doesn't exists on osu!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_USER_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: `No osu! username or user id provided`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_USER_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: `Not a valid osu username or id`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_BEATMAP_ID_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: `Not a valid osu beatmap id`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_BEATMAP_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: `That beatmap doesn't exists on osu!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_BEATMAP_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: `No osu! beatmap id provided`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class osu {

    async onCommand(command: string, args: any, message: Message) {
        
        if(command.toLowerCase() !== 'osu') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'osu') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        if(data.guild === null || data.guildId === null) return;
        
        const Guild = await Prisma.client.guild.findFirst({ where: { id: data.guildId }})
        if(!Guild) throw new Error('TODO: Handle if guild is not found');
        

        const funct = {
            user: async(data: Message | CommandInteraction) => {
            
                let user;
                if(data instanceof Message) {
                    if(typeof args[1] === 'undefined')
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_USER_MENTIONED(data)] });
                    const [removed, ...newArgs] = args;
                    user = newArgs.join(" ");
                }
                else if(data instanceof CommandInteraction)
                    user = data.options.getString('user');


                if(!validator.isNumeric(user) && !this.validate_osu_username(user))
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.INVALID_USER_MENTIONED(data)] });

                let result = await osuAPI.client.getUser({ u: user });

                if(result instanceof Array && result.length === 0)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_USER_FOUND(data)] });

                if(isSlashCommand) {
                    await (data as CommandInteraction).deferReply();
                }

                const level = {
                    number: (Math.round((result.level + Number.EPSILON) * 100) / 100).toFixed(2).split('.')[0],
                    progression: (Math.round((result.level + Number.EPSILON) * 100) / 100).toFixed(2).split('.')[1]
                }
                const embed = makeInfoEmbed ({
                    icon: '',
                    title: `${countryCodeEmoji(result.country)}  ${result.name}`,
                    //description: `${member.user.username}#${member.user.discriminator} (${member.user.id})`,
                    fields: [
                        {
                            name: `🏆  Level **${level.number}** (${level.progression}% progress to the next level)`,
                            value: `Play Count **${this.numberWithCommas(result.counts.plays)}**, totaling in **${this.numberWithCommas(parseFloat(((Math.round(((result.secondsPlayed / (60 * 60)) + Number.EPSILON) * 100) / 100).toFixed(2))))} ${result.secondsPlayed < 60 ? 'hour' : 'hours'}** of songs played
                            \u200b`,
                        },
                        {
                            name: "🌎  World Ranking",
                            value: `**#${this.numberWithCommas(result.pp.rank)}**`,
                            inline: true
                        },
                        {
                            name: `${countryCodeEmoji(result.country)}  Country Ranking`,
                            value: `**#${this.numberWithCommas(result.pp.countryRank)}** ${countryLookup.byInternet(result.country)!.country}`,
                            inline: true
                        },
                        {
                            name: "🎀  Total Score",
                            value: `**${this.numberWithCommas(result.scores.total)}**`,
                            inline: true
                        },
                        {
                            name: "✨  PP",
                            value: `**${this.numberWithCommas(result.pp.raw)}pp**`,
                            inline: true
                        },
                        {
                            name: "⭕  Hit Accuracy",
                            value: `**${result.accuracyFormatted}**`,
                            inline: true
                        },
                        {
                            name: "🌠  Ranked Score",
                            value: `**${this.numberWithCommas(result.scores.ranked)}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: "🥇  SSH",
                            value: `**${this.numberWithCommas(result.counts.SSH)}**`,
                            inline: true
                        },
                        {
                            name: "🥇  SH",
                            value: `**${this.numberWithCommas(result.counts.SH)}**`,
                            inline: true
                        },
                        {
                            name: "🥇  SS",
                            value: `**${this.numberWithCommas(result.counts.SS)}**`,
                            inline: true
                        },
                        {
                            name: "🥈  S",
                            value: `**${this.numberWithCommas(result.counts.S)}**`,
                            inline: true
                        },
                        {
                            name: "🥉  A",
                            value: `**${this.numberWithCommas(result.counts.A)}**`,
                            inline: true
                        },
                        {
                            name: "🏅  > A / Total plays",
                            value: `**${this.numberWithCommas(result.counts.SSH + result.counts.SH + result.counts.SS + result.counts.S + result.counts.A)}** (${(Math.round((((result.counts.SSH + result.counts.SH + result.counts.SS + result.counts.S + result.counts.A) / (result.counts.plays == 0 ? 1 : result.counts.plays)) + Number.EPSILON) * 10000) / 10000).toFixed(4)})
                            \u200b`,
                            inline: true
                        },
                        {
                            name: `❤  Account Information`,
                            value: `Joined: <t:${Math.round(new Date(result.raw_joinDate).getTime() / 1000)}:R>, <t:${Math.round(new Date(result.raw_joinDate).getTime() / 1000)}:f>`
                        }//,
                        /*{
                            name: `💌  Recent Events (Coming soon)`,
                            value: `*How about we explore the area ahead of us later?*`
                        }*/
                    ],
                    user: (data instanceof Interaction) ? data.user : data.author
                });

                embed.setAuthor(`${result.name}'s osu profile`, 'https://upload.wikimedia.org/wikipedia/commons/4/44/Osu%21Logo_%282019%29.png', `https://osu.ppy.sh/users/${result.id}`);
                // TODO: Fix for ppl with no image
                embed.setThumbnail(`https://a.ppy.sh/${result.id}` || 'https://osu.ppy.sh/images/layout/avatar-guest.png');

                const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setEmoji('🔗')
                        .setLabel('  Open Profile')
                        .setURL(`https://osu.ppy.sh/users/${result.id}`)
                        .setStyle('LINK'),
                )

                return await sendMessageOrInteractionResponse(data, { embeds: [embed], components: [row] }); 
            },
            beatmap: async(data: Message | CommandInteraction) => {
            
                let beatmap;
                if(data instanceof Message) {
                    if(typeof args[1] === 'undefined')
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_BEATMAP_MENTIONED(data)] });
                    const [removed, ...newArgs] = args;
                    beatmap = newArgs.join(" ");
                }
                else if(data instanceof CommandInteraction)
                    beatmap = data.options.getString('beatmap');

                    
                if(!validator.isNumeric(beatmap))
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.INVALID_BEATMAP_ID_MENTIONED(data)] });

                let result = await osuAPI.client.getBeatmaps({ b: beatmap });

                if(result instanceof Array && result.length === 0)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_BEATMAP_FOUND(data)] });

                if(isSlashCommand) {
                    await (data as CommandInteraction).deferReply();
                }

                const bm_result = result[0];
                
                let url_mode = "#osu";
                let statusEmoji = "⚪";
                let mode: unknown = bm_result.mode;
                let status: unknown = bm_result.approvalStatus;

                if((mode as String) === "Taiko")
                    url_mode = "#taiko";
                else if((mode as String) === "Catch the Beat")
                    url_mode = "#fruits";
                else if((mode as String) === "Mania")
                    url_mode = "#mania";

                if((status as String) === "Ranked")
                    statusEmoji = "🏆";
                else if((status as String) === "Loved")
                    statusEmoji = "❤";
                else if((status as String) === "Qualified")
                    statusEmoji = "✅";
                else if((status as String) === "WIP")
                    statusEmoji = "🛠";
                else if((status as String) === "Pending")
                    statusEmoji = "⌛";
                else if((status as String) === "Graveyard")
                    statusEmoji = "💀";

                const embed2 = makeInfoEmbed ({
                    icon: '',
                    title: `${bm_result.title} - ${bm_result.artist}`,
                    fields: [
                        {
                            name: `Difficulty **[${bm_result.version}]**`,
                            value: `Mapper [${bm_result.creator}](${encodeURI('https://osu.ppy.sh/u/'+ bm_result.creator)})
                            Rating **${bm_result.rating.toFixed(2)}/10**
                            \u200b`,
                        },
                        {
                            name: "⭐  Star Difficulty",
                            value: `**${(Math.round((bm_result.difficulty.rating + Number.EPSILON) * 100) / 100).toFixed(2)}**`,
                            inline: true
                        },
                        {
                            name: `⌛ Length`,
                            value: `**${(Math.round(((bm_result.length.total / 60) + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ':')}**`,
                            inline: true
                        },
                        {
                            name: "🏓  Combo",
                            value: `**${this.numberWithCommas(bm_result.maxCombo)}**`,
                            inline: true
                        },
                        {
                            name: "🕹  Mode",
                            value: `**${mode}**`,
                            inline: true
                        },
                        {
                            name: "🎵  BPM",
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
                            name: "⭕  Circle",
                            value: `**${bm_result.objects.normal}**`,
                            inline: true
                        },
                        {
                            name: "💨  Slider",
                            value: `**${bm_result.objects.slider}**`,
                            inline: true
                        },
                        {
                            name: "💫  Spinner",
                            value: `**${bm_result.objects.spinner}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: `🎶  Track Information`,
                            value: `Language: **${bm_result.language}**
                            Genre: **${bm_result.genre}**
                            Submission Date: <t:${Math.round(new Date(bm_result.raw_submitDate).getTime() / 1000)}:R>, <t:${Math.round(new Date(bm_result.raw_submitDate).getTime() / 1000)}:f>
                            Last updated: <t:${Math.round(new Date(bm_result.raw_lastUpdate).getTime() / 1000)}:R>, <t:${Math.round(new Date(bm_result.raw_lastUpdate).getTime() / 1000)}:f>
                            Approved: <t:${Math.round(new Date(bm_result.raw_approvedDate).getTime() / 1000)}:R>, <t:${Math.round(new Date(bm_result.raw_approvedDate).getTime() / 1000)}:f>
                            \u200b`,
                        },
                        {
                            name: "▶  Plays",
                            value: `**${this.numberWithCommas(bm_result.counts.plays)}**`,
                            inline: true
                        },
                        {
                            name: "🏁  Passes",
                            value: `**${this.numberWithCommas(bm_result.counts.passes)}**`,
                            inline: true
                        },
                        {
                            name: "♥  Favorites",
                            value: `**${this.numberWithCommas(bm_result.counts.favorites)}**
                            \u200b`,
                            inline: true
                        },
                        {
                            name: `📌  Tags`,
                            value: `\`\`${bm_result.tags.join(" ")}\`\``,
                        }
                    ],
                    user: (data instanceof Interaction) ? data.user : data.author
                });

                embed2.setAuthor(`osu! beatmap`, 'https://upload.wikimedia.org/wikipedia/commons/4/44/Osu%21Logo_%282019%29.png', `https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}${url_mode}/${bm_result.id}`);
                embed2.setImage(`https://assets.ppy.sh/beatmaps/${bm_result.beatmapSetId}/covers/cover.jpg`);
                //
                const row = new MessageActionRow();
                if(bm_result.hasDownload)
                    row.addComponents(
                        new MessageButton()
                            .setEmoji('🌎')
                            .setLabel('  Download (Beatconnect)')
                            .setURL(`https://beatconnect.io/b/${bm_result.beatmapSetId}/`)
                            .setStyle('LINK'),
                    )
                row.addComponents(
                    new MessageButton()
                        .setEmoji('🔗')
                        .setLabel('  Open listing')
                        .setURL(`https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}${url_mode}/${bm_result.id}`)
                        .setStyle('LINK'),
                )    
                row.addComponents(
                    new MessageButton()
                        .setEmoji('💬')
                        .setLabel('  Open discussion')
                        .setURL(`https://osu.ppy.sh/beatmapsets/${bm_result.beatmapSetId}/discussion`)
                        .setStyle('LINK'),
                )
                
                return await sendMessageOrInteractionResponse(data, { embeds: [embed2], components: [row] }); 
            }
        }

        let query;

        if(isMessage) {
            if(args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.osu_INFO(data)] });
            }
            query = args[0].toLowerCase();
        }
        else if(isSlashCommand) {
            query = args.getSubcommand();
        }

        switch(query) {
            case "user":
            case "u":
                return await funct.user(data);
            case "beatmap":
            case "b":
                return await funct.beatmap(data);
        }

    }
    private numberWithCommas(x: Number) {
        try {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        } catch(err) {
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
        if (username.includes('  ') || !(/^[A-Za-z0-9-\[\]_ ]+$/.test(username))) return false;

        //username_no_space_userscore_mix
        if (username.includes('_') && username.includes(' ')) return false;

        return true;
    }
}