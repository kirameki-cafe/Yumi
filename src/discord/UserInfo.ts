import { Message, Interaction, CommandInteraction } from 'discord.js';
import { getColorFromURL } from 'color-thief-node';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import {
    sendHybridInteractionMessageResponse,
    makeErrorEmbed,
    makeInfoEmbed
} from '../utils/DiscordMessage';

const EMBEDS = {
    SAY_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'User Info',
            description: `View info on discord user`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``Discord user mention or id``'
                }
            ],
            user: data instanceof Interaction ? data.user : data.author
        });
    },
    USER_NOT_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'That user cannot be found!',
            user: data instanceof Interaction ? data.user : data.author
        });
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
        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.SAY_INFO(data.getRaw())]
                });

            if (typeof data.getMessage().mentions.users.first() !== 'undefined')
                query = data.getMessage().mentions.users.first()?.id;
            else query = args[0];
        } else if (data.isSlashCommand())
            query = data.getSlashCommand().options.getUser('user')?.id;

        // Find the user want to look up
        let TargetMember = (await data.getGuild()!.members.fetch()).get(query);
        if (!TargetMember)
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.USER_NOT_FOUND(data.getRaw())]
            });

        if (data.isSlashCommand()) await data.getMessageComponentInteraction().deferReply();

        let readableStatus: string;

        switch (TargetMember.presence?.status) {
            case 'online':
                readableStatus = '🟢  Online';
                break;
            case 'idle':
                readableStatus = '🌙  Idle';
                break;
            case 'dnd':
                readableStatus = '⛔  Do not disturb';
                break;
            case 'offline':
                readableStatus = '⚫  Offline';
                break;
            default:
                readableStatus = '❓  Unknown';
                break;
        }

        const embed = makeInfoEmbed({
            icon: '',
            title: `${TargetMember.user.tag}`,
            fields: [
                {
                    name: `${readableStatus}`,
                    value: `\u200b`
                }
            ],
            user: data.getUser()
        });

        if (TargetMember.presence?.activities)
            for (let activity of TargetMember.presence?.activities) {
                if (activity.type === 'CUSTOM')
                    embed.addField(
                        `✨  ${activity.name}`,
                        `${
                            !activity.emoji
                                ? ''
                                : `${
                                      activity.emoji?.identifier.startsWith('%')
                                          ? activity.emoji?.name
                                          : '<' + activity.emoji?.identifier + '>'
                                  }`
                        }  ${activity.state === null ? '' : activity.state}
                     \u200b`,
                        true
                    );
                else {
                    let emoji = '';
                    switch (activity.type) {
                        case 'PLAYING':
                            emoji = '🕹  ';
                            break;
                        case 'STREAMING':
                            emoji = '🔴  ';
                            break;
                        case 'LISTENING':
                            emoji = '🎵  ';
                            break;
                        case 'WATCHING':
                            emoji = '📺  ';
                            break;
                        case 'COMPETING':
                            emoji = '🌠  ';
                            break;
                    }
                    embed.addField(
                        `${emoji}${
                            activity.type.toLowerCase().charAt(0).toUpperCase() +
                            activity.type.toLowerCase().slice(1)
                        } ${activity.name}`,
                        `${activity.details === null ? '' : activity.details}
                    ${activity.state === null ? '' : activity.state}
                    Since <t:${Math.round(new Date(activity.createdAt).getTime() / 1000)}:R>
                    \u200b`,
                        true
                    );
                }
            }

        embed.addField(
            `📰  Information on this guild`,
            `${
                TargetMember.joinedAt === null
                    ? 'Cannot determine joined date'
                    : `Joined <t:${Math.round(TargetMember.joinedAt.getTime() / 1000)}:R>`
            }
            ${TargetMember.id === data.getGuild()!.ownerId ? 'Owner of this guild 👑' : ''}
            `
        );

        try {
            const colorthief = await getColorFromURL(
                TargetMember.user.displayAvatarURL().replace('.webp', '.jpg')
            );
            embed.setColor(colorthief);
        } catch (err) {}

        embed.setThumbnail(TargetMember.user.displayAvatarURL());
        embed.setAuthor({
            name: `${TargetMember.displayName}`,
            iconURL: TargetMember.user.displayAvatarURL()
        });

        return await sendHybridInteractionMessageResponse(data, { embeds: [embed] });
    }
}
