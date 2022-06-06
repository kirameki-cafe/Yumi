import { Message, CommandInteraction, Presence, PresenceStatus } from 'discord.js';
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
                if (activity.type === 'CUSTOM')
                    embed.addField(
                        `✨  ${locale.__('userinfo.custom_status')}`,
                        `${
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
                        false
                    );
                else {
                    let title = '';
                    switch (activity.type) {
                        case 'PLAYING':
                            title = `'🕹 ${locale.__('userinfo.playing_x', activity.name)}`;
                            break;
                        case 'STREAMING':
                            title = `'🔴 ${locale.__('userinfo.streaming_x', activity.name)}`;
                            break;
                        case 'LISTENING':
                            title = `🎵 ${locale.__('userinfo.listening_x', activity.name)}`;
                            break;
                        case 'WATCHING':
                            title = `📺 ${locale.__('userinfo.watching_x', activity.name)}`;
                            break;
                        case 'COMPETING':
                            title = `'🌠 ${locale.__('userinfo.competing_x', activity.name)}`;
                            break;
                    }
                    embed.addField(
                        `${title}`,
                        `${activity.details === null ? '' : activity.details}
                    ${activity.state === null ? '' : activity.state}
                    Since <t:${Math.round(new Date(activity.createdAt).getTime() / 1000)}:R>
                    \u200b`,
                        false
                    );
                }
            }
        }

        embed.addField(
            `📰 ${locale.__('userinfo.user_guild_info')}`,
            `${
                user.joinedAt === null
                    ? locale.__('userinfo.join_date_unknown')
                    : locale.__('userinfo.join_date', `<t:${Math.round(user.joinedAt.getTime() / 1000)}:R>`)
            }
            ${user.isGuildOwner ? `${locale.__('userinfo.guild_owner')}` : ''}
            `
        );

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
        } else if (data.isSlashCommand()) query = data.getSlashCommand().options.getUser('user')?.id;

        // Find the user want to look up
        let TargetMember = (await guild.members.fetch()).get(query);
        if (!TargetMember)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.USER_NOT_FOUND(data, locale)]
            });

        if (data.isSlashCommand()) await data.getMessageComponentInteraction().deferReply();

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
