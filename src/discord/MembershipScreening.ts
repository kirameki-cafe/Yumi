import DiscordModule, { HybridInteractionMessage } from "../utils/DiscordModule";

import { GuildChannel, GuildMember, Message, Permissions, TextChannel, MessageActionRow, MessageButton, Interaction, CommandInteraction, Role, ThreadChannel, ButtonInteraction } from "discord.js";
import App from "..";
import { makeSuccessEmbed, makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse, sendMessage } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";

const EMBEDS = {
    NO_PERMISSION: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'You need ``ADMINISTRATOR`` permission on this guild!',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_PARAMETER: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Missing parameter',
            description: `You must define membership screening channel and role to enable this feature`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_ROLE_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'No role mentioned',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_ROLE_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Cannot find that role',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_CHANNEL_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'No channel mentioned',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_CHANNEL_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Cannot find that channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    MSINFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Membership Screening',
            description: `Membership Screening is a feature to prevent unwanted people to join your guild, similar to whitelist feature. Moderators can approve or deny join request`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``setRole`` ``setChannel`` ``createMessage``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ALREADY_ENABLED: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Membership Screening is already enabled',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    MESSAGE_CREATED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: 'Membership Screening message created',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ALREADY_DISABLED: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Membership Screening is already disabled',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ENABLED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: 'Enabled Membership Screening',
            description: `All new member join request will be sent in your defined channel`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    DISABLED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: 'Disabled Membership Screening',
            description: `No longer accepting request, all new member can join directly`,
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    MANAGED_ROLE: (data: Message | Interaction, role: Role) => {
        return makeErrorEmbed({
            title: 'You cannot use this role',
            description: '``' + role.name + '``' + ' is managed by external service and cannot be used',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    CONFIGURED_ROLE: (data: Message | Interaction, role: Role) => {
        return makeSuccessEmbed({
            title: 'Configured Membership Screening Role',
            description: 'New member will be given a ' + '``' + role.name + '``' + ' role after approval',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    CONFIGURED_CHANNEL: (data: Message | Interaction, channel: GuildChannel) => {
        return makeSuccessEmbed({
            title: 'Configured Membership Screening Channel',
            description: 'Anyone with ``VIEW_CHANNEL`` permission in ' + '``' + channel.name + '``' + ' can approve or deny request',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_CHANNEL: (data: Message | Interaction, channel: GuildChannel) => {
        return makeErrorEmbed({
            title: 'Invalid channel type, only TextChannel is supported',
            description: '``' + channel.name + '``' + ' is not a text channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_CHANNEL_THREAD: (data: Message | Interaction, channel: GuildChannel | ThreadChannel) => {
        return makeErrorEmbed({
            title: 'Thread channel is not supported',
            description: '``' + channel.name + '``' + ' is a thread channel. Please use a regular text channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    BOT_NO_PERMISSION: (data: Message | Interaction, channel: GuildChannel) => {
        return makeErrorEmbed({
            title: `I don't have permission`,
            description: 'I cannot access/send message in ' + '``' + channel.name + '``',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_LONGER_VALID_ROLE: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'The configured role is no longer valid. Please update the role in configuration',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    CANNOT_PERFORM_ASSIGN_ROLE: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Cannot grant the role to user, make sure I have permission to do that',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    CANNOT_PERFORM_ASSIGN_KICK: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Cannot kick the user, make sure I have permission to do that',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    CANNOT_PERFORM_ASSIGN_BAN: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Cannot ban the user, make sure I have permission to do that',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    CREATE_MESSAGE: () => {
        return makeInfoEmbed({
            icon: '👋',
            title: 'Welcome to this server!',
            description: `This server have membership screening enabled, **you'll have access to the server when the moderators let you in**.\n\nAlso please make sure that you acknowledged the common rules that everyone should be doing no matter where, Discord ToS (https://discordapp.com/terms)`,
            user: DiscordProvider.client.user
        })
    }
}

export default class MembershipScreening extends DiscordModule {

    public id = "Discord_MembershipScreening";
    public commands = ["membershipscreening", "ms"];
    public commandInteractionName = "membershipscreening";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async GuildButtonInteractionCreate(interaction: ButtonInteraction) {

        const hybridData = new HybridInteractionMessage(interaction);
        const guild = hybridData.getGuild();
        const user = hybridData.getUser();
        const channel = hybridData.getChannel();

        if(!guild || !user || !channel) return;

        if (!this.isJsonValid(interaction.customId)) return;
        const payload = JSON.parse(interaction.customId);

        if (typeof payload.m === 'undefined' ||
            typeof payload.a === 'undefined' ||
            payload.m !== 'MembershipScreening') return;

        const message = await channel.messages.fetch(interaction.message.id);
        if (!message) return;

        const embed = message.embeds;
        if (!embed || embed.length === 0) return;

        const PrismaGuild = await Prisma.client.guild.findFirst({ where: { id: guild.id } });
        if (!PrismaGuild) return;

        if (!PrismaGuild.MembershipScreening_Enabled ||
            PrismaGuild.MembershipScreening_ApprovalChannel === null ||
            PrismaGuild.MembershipScreening_GivenRole === null) return;

        embed[0].footer = {
            text: `${interaction.user.username}  |  v${App.version}`,
            iconURL: `${interaction.user.avatarURL()}?size=4096` || ''
        }

        if (['approve', 'deny', 'ban'].includes(payload.a)) {

            if (!payload.d.requester) return;

            const role = (await guild.roles.fetch()).find(role => role.id === PrismaGuild.MembershipScreening_GivenRole);
            const requesterMember = (await guild.members.fetch()).find(member => member.id === payload.d.requester);

            if (!role)
                return await interaction.reply({ ephemeral: true, embeds: [EMBEDS.NO_LONGER_VALID_ROLE(interaction)] });

            if (!requesterMember) {
                embed[0].addField("❌ Invalid", `Unable to find the user. User left already?`);
                return await message.edit({ components: [], embeds: embed });
            }

            if (requesterMember.roles.cache.has(PrismaGuild.MembershipScreening_GivenRole)) {
                embed[0].addField("✅ Approved", `By: Unknown (User already obtained the role by other means)`);
                return await message.edit({ components: [], embeds: embed });
            }

            if (payload.a === 'approve') {
                try {
                    await requesterMember.roles.add(role);
                    embed[0].addField("✅ Approved", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                    await message.edit({ components: [], embeds: embed });
                }
                catch (err) {
                    return interaction.reply({ ephemeral: true, embeds: [EMBEDS.CANNOT_PERFORM_ASSIGN_ROLE(message)] });
                }
            }

            else if (payload.a === 'deny') {
                try {
                    await requesterMember.kick();
                    embed[0].addField("❌ Denied", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                    await message.edit({ components: [], embeds: embed });
                }
                catch (err) {
                    return interaction.reply({ ephemeral: true, embeds: [EMBEDS.CANNOT_PERFORM_ASSIGN_KICK(message)] });
                }
            }

            else if (payload.a === 'ban') {
                try {
                    await requesterMember.ban({
                        reason: `Membership Screening, action issued by ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`
                    });
                    embed[0].addField("🔪 Banned", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                    await message.edit({ components: [], embeds: embed });
                }
                catch (err) {
                    return interaction.reply({ ephemeral: true, embeds: [EMBEDS.CANNOT_PERFORM_ASSIGN_BAN(message)] });
                }
            }

        }
    }

    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();
        const user = data.getUser();
        const member = data.getMember();
        const channel = data.getChannel();

        if (!guild || !user || !member || !channel) return;

        const PrismaGuild = await Prisma.client.guild.findFirst({ where: { id: guild.id } })
        if (!PrismaGuild) return;


        const funct = {
            enable: async (data: HybridInteractionMessage) => {
                if (!PrismaGuild.MembershipScreening_Enabled) {

                    if (PrismaGuild.MembershipScreening_GivenRole === null || PrismaGuild.MembershipScreening_ApprovalChannel == null)
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PARAMETER(data.getRaw())] });

                    await Prisma.client.guild.update({ where: { id: guild.id }, data: { MembershipScreening_Enabled: true } });

                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ENABLED(data.getRaw())] });
                }

                else
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ALREADY_ENABLED(data.getRaw())] });
            },
            disable: async (data: HybridInteractionMessage) => {
                if (PrismaGuild.MembershipScreening_Enabled) {
                    await Prisma.client.guild.update({
                        where: { id: guild.id },
                        data: { MembershipScreening_Enabled: false }
                    });

                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.DISABLED(data.getRaw())] });
                }
                else
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ALREADY_DISABLED(data.getRaw())] });
            },
            setRole: async (data: HybridInteractionMessage) => {

                let role: Role | undefined;

                if (data.isMessage()) {
                    let _name: string;
                    if (typeof args[1] === 'undefined')
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_ROLE_MENTIONED(data.getRaw())] });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");

                    role = data.getMessage().mentions.roles.first() || guild.roles.cache.find(role => role.name === _name);
                }
                else if (data.isSlashCommand())
                    role = guild.roles.cache.find(role => role.id === data.getSlashCommand().options.getRole('role')?.id);

                if (!role)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_ROLE_FOUND(data.getRaw())] });

                if (role.managed)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.MANAGED_ROLE(data.getRaw(), role)] });

                await Prisma.client.guild.update({ where: { id: guild.id }, data: { MembershipScreening_GivenRole: role.id } });

                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.CONFIGURED_ROLE(data.getRaw(), role)] });
            },
            setChannel: async (data: HybridInteractionMessage) => {

                let mentionChannel;
                if (data.isMessage()) {
                    if (!args[1])
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_CHANNEL_MENTIONED(data.getRaw())] });
                    mentionChannel = data.getMessage().mentions.channels.first();
                }
                else if (data.isSlashCommand())
                    mentionChannel = data.getSlashCommand().options.getChannel('channel');

                if (!mentionChannel)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_CHANNEL_FOUND(data.getRaw())] });

                let TargetChannel = guild.channels.cache.get(mentionChannel.id);
                if (!TargetChannel) return;

                if (TargetChannel instanceof ThreadChannel || TargetChannel.isThread())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL_THREAD(data.getRaw(), TargetChannel)] });

                if (!TargetChannel.isText())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL(data.getRaw(), TargetChannel)] });

                if (!(guild.me!.permissionsIn(TargetChannel).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.VIEW_CHANNEL])))
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.BOT_NO_PERMISSION(data.getRaw(), TargetChannel)] });

                await Prisma.client.guild.update({ where: { id: guild.id }, data: { MembershipScreening_ApprovalChannel: mentionChannel.id } });
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.CONFIGURED_CHANNEL(data.getRaw(), TargetChannel)] });
            },
            createMessage: async (data: HybridInteractionMessage) => {
                if(data.isMessage())
                    return await sendMessage(channel, undefined, { embeds: [EMBEDS.CREATE_MESSAGE()] });
                else if(data.isSlashCommand()) {
                    await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.MESSAGE_CREATED(data.getRaw())] });
                    return await sendMessage(channel, undefined, { embeds: [EMBEDS.CREATE_MESSAGE()] });
                }
            }
        }

        let query;

        if (!member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data.getRaw())] });

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.MSINFO(data.getRaw())] });
            
            query = args[0].toLowerCase();
        }
        else if (data.isSlashCommand())
            query = args.getSubcommand();

        switch (query) {
            case "enable":
            case "on":
                return await funct.enable(data);
            case "disable":
            case "off":
                return await funct.disable(data);
            case "setrole":
                return await funct.setRole(data);
            case "setchannel":
                return await funct.setChannel(data);
            case "createmessage":
                return await funct.createMessage(data);
        }

    }

    async GuildMemberAdd(member: GuildMember) {

        if (member.user.bot) return;

        const Guild = await Prisma.client.guild.findFirst({ where: { id: member.guild.id } });
        if (!Guild) return;

        if (!Guild.MembershipScreening_Enabled) return;
        if (Guild.MembershipScreening_ApprovalChannel === null) return;
        if (Guild.MembershipScreening_GivenRole === null) return;

        let channel = undefined;
        try {
            channel = await DiscordProvider.client.channels.fetch(Guild.MembershipScreening_ApprovalChannel) as TextChannel;
        } catch (err) {
            // TODO: Handle channel not found error
            return;
        }
        if (!channel) return;

        const embed = makeInfoEmbed({
            title: 'New member joined!',
            description: `${member.user.username}#${member.user.discriminator} (${member.user.id})`,
            fields: [
                {
                    name: "Account Information",
                    value: `Account age: <t:${Math.round(member.user.createdAt.getTime() / 1000)}:R>`
                }
            ]
        });

        embed.setThumbnail(`${member.user.avatarURL()}?size=4096` || '');

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(JSON.stringify({
                        m: 'MembershipScreening',
                        a: 'approve',
                        d: {
                            requester: member.id
                        }
                    }))
                    .setEmoji('✅')
                    .setLabel('  Approve')
                    .setStyle('SUCCESS'),
            )
            .addComponents(
                new MessageButton()
                    .setCustomId(JSON.stringify({
                        m: 'MembershipScreening',
                        a: 'deny',
                        d: {
                            requester: member.id
                        }
                    }))
                    .setEmoji('⛔')
                    .setLabel('  Deny and kick')
                    .setStyle('DANGER'),
            )
            .addComponents(
                new MessageButton()
                    .setCustomId(JSON.stringify({
                        m: 'MembershipScreening',
                        a: 'ban',
                        d: {
                            requester: member.id
                        }
                    }))
                    .setEmoji('🔪')
                    .setLabel('  Vision Hunt Decree (Ban)')
                    .setStyle('DANGER'),
            )

        await channel.send({ content: '\u200b', embeds: [embed], components: [row] });
    }

    private isJsonValid(jsonString: string) {
        try {
            let o = JSON.parse(jsonString);
            if (o && typeof o === "object") {
                return true;
                //return o;
            }
        }
        catch (e) { }

        return false;
    }
}