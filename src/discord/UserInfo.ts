import { Message, CommandInteraction, Presence, PresenceStatus, ActivityType } from 'discord.js';
import { getColorFromURL, Palette } from 'color-thief-node';
import { I18n } from 'i18n';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { sendHybridInteractionMessageResponse, makeErrorEmbed, makeInfoEmbed } from '../utils/DiscordMessage';
import Locale from '../services/Locale';

interface UserInfoData {
    displayName: string;
    tag: string;
    status: PresenceStatus | null;
    joinedAt: Date | null;
    displayAvatarURL: string;
    isGuildOwner: boolean;
    presence: Presence | null;
    colorThiefColor: Palette | null;
}

const EMBEDS = {
    INFO: (data: HybridInteractionMessage, locale: I18n) => {
        return makeInfoEmbed({
            title: locale.__('userinfo.title'),
            description: locale.__('userinfo.info'),
            fields: [
                {
                    name: locale.__('common.available_args'),
                    value: locale.__('userinfo.valid_args')
                }
            ],
            user: data.getUser()
        });
    },
    USER_NOT_FOUND: (data: HybridInteractionMessage, locale: I18n) => {
        return makeErrorEmbed({
            title: locale.__('userinfo.user_not_found'),
            user: data.getUser()
        });
    },
    USER_INFO: (data: HybridInteractionMessage, locale: I18n, user: UserInfoData) => {
        let readableStatus: string;

        switch (user.status) {
            case 'online':
                readableStatus = `🟢  ${locale.__('userinfo.online')}`;
                break;
            case 'idle':
                readableStatus = `🌙  ${locale.__('userinfo.idle')}`;
                break;
            case 'dnd':
                readableStatus = `⛔  ${locale.__('userinfo.dnd')}`;
                break;
            case 'offline':
                readableStatus = `⚫  ${locale.__('userinfo.offline')}`;
                break;
            default:
                readableStatus = `⚫  ${locale.__('userinfo.unknown')}`;
                break;
        }

        let embed = makeInfoEmbed({
            icon: null,
            title: user.tag,
            fields: [
                {
                    name: `${readableStatus}`,
                    value: `\u200b`
                }
            ],
            color: user.colorThiefColor || undefined,
            user: data.getUser()
        });

        if (user.presence?.activities) {
            for (let activity of user.presence?.activities) {
                if (activity.type === ActivityType.Custom)
                    embed.addFields({
                        name: `✨  ${locale.__('userinfo.custom_status')}`,
                        value: `${
                            !activity.emoji
                                ? ''
                                : `${
                                      activity.emoji?.identifier.startsWith('<') &&
                                      activity.emoji?.identifier.endsWith('>') &&
                                      activity.emoji?.identifier.split(':').length == 2
                                          ? activity.emoji?.identifier.split(':')[0]
                                          : activity.emoji?.name
                                  }`
                        }  ${activity.state === null ? '' : activity.state}
                     \u200b`,
                        inline: false
                    });
                else {
                    let title = '';
                    switch (activity.type) {
                        case ActivityType.Playing:
                            title = `'🕹 ${locale.__('userinfo.playing_x', { NAME: activity.name })}`;
                            break;
                        case ActivityType.Streaming:
                            title = `'🔴 ${locale.__('userinfo.streaming_x', { NAME: activity.name })}`;
                            break;
                        case ActivityType.Listening:
                            title = `🎵 ${locale.__('userinfo.listening_x', { NAME: activity.name })}`;
                            break;
                        case ActivityType.Watching:
                            title = `📺 ${locale.__('userinfo.watching_x', { NAME: activity.name })}`;
                            break;
                        case ActivityType.Competing:
                            title = `🌠 ${locale.__('userinfo.competing_x', { NAME: activity.name })}`;
                            break;
                    }
                    const startTime = activity.timestamps?.start;
                    const endTime = activity.timestamps?.end;
                    embed.addFields({
                        name: `${title}`,
                        value: `${activity.details === null ? '' : activity.details}
                        ${activity.state === null ? '' : activity.state}
                        ${
                            startTime
                                ? `Since <t:${Math.round(startTime.getTime() / 1000)}:R>`
                                : ''
                        }${
                            endTime
                                ? `\nEnd <t:${Math.round(endTime.getTime() / 1000)}:R>`
                                : ''
                        }
                        \u200b`,
                        inline: false
                    });
                }
            }
        }

        embed.addFields({
            name: `📰 ${locale.__('userinfo.user_guild_info')}`,
            value: `${
                user.joinedAt === null
                    ? locale.__('userinfo.join_date_unknown')
                    : locale.__('userinfo.join_date', {
                          TIME: `<t:${Math.round(user.joinedAt.getTime() / 1000).toString()}:R>`
                      })
            }
            ${user.isGuildOwner ? `${locale.__('userinfo.guild_owner')}` : ''}
            `
        });

        embed.setThumbnail(user.displayAvatarURL + '?size=4096');
        embed.setAuthor({
            name: user.displayName,
            iconURL: user.displayAvatarURL + '?size=4096'
        });

        return embed;
    }
};

export default class UserInfo extends DiscordModule {
    public id = 'Discord_UserInfo';
    public commands = ['userinfo'];
    public commandInteractionName = 'userinfo';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        if (!guild) return;

        const locale = await Locale.getGuildLocale(guild.id);

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.INFO(data, locale)]
                });

            if (typeof data.getMessage().mentions.users.first() !== 'undefined')
                query = data.getMessage().mentions.users.first()?.id;
            else query = args[0];
        } else if (data.isApplicationCommand()) query = data.getSlashCommand().options.getUser('user')?.id;

        // Find the user want to look up
        let TargetMember = (await guild.members.fetch()).get(query);
        if (!TargetMember)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.USER_NOT_FOUND(data, locale)]
            });

        if (data.isApplicationCommand()) await data.getMessageComponentInteraction().deferReply();

        let colorthief = null;
        try {
            colorthief = await getColorFromURL(TargetMember.user.displayAvatarURL().replace('.webp', '.jpg'));
        } catch (err) {}

        const userInfoData: UserInfoData = {
            tag: TargetMember.user.tag,
            status: TargetMember.presence?.status ? TargetMember.presence?.status : null,
            displayName: TargetMember.displayName,
            joinedAt: TargetMember.joinedAt,
            displayAvatarURL: TargetMember.displayAvatarURL(),
            presence: TargetMember.presence || null,
            isGuildOwner: TargetMember.id === guild.ownerId,
            colorThiefColor: colorthief
        };

        return await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.USER_INFO(data, locale, userInfoData)]
        });
    }
}
