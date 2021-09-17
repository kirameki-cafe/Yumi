import { Channel, channel } from "diagnostics_channel";
import { GuildChannel, GuildMember, Message, Permissions, TextChannel, MessageActionRow, MessageButton, Interaction, CommandInteraction, Role, ThreadChannel } from "discord.js";
import App from "..";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, makeInfoEmbed, makeErrorEmbed, sendMessage, sendReply } from "../utils/DiscordMessage";
import Logger from "../libs/Logger";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";
import { MessageOptions } from "child_process";

const EMBEDS = {
    NO_PERMISSION: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'You need ``ADMINISTRATOR`` permission on this guild!',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_PARAMETER: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Missing parameter',
            description: `You must define membership screening channel and role to enable this feature`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_ROLE_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'No role mentioned',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_ROLE_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Cannot find that role',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_CHANNEL_MENTIONED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'No channel mentioned',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_CHANNEL_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Cannot find that channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    MSINFO:(data: Message | Interaction) => {
        return makeInfoEmbed ({
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
        return makeInfoEmbed ({
            title: 'Membership Screening is already enabled',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ALREADY_DISABLED: (data: Message | Interaction) => {
        return makeInfoEmbed ({
            title: 'Membership Screening is already disabled',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ENABLED: (data: Message | Interaction) => {
        return makeSuccessEmbed ({
            title: 'Enabled Membership Screening',
            description: `All new member join request will be sent in your defined channel`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    DISABLED: (data: Message | Interaction) => {
        return makeSuccessEmbed ({
            title: 'Disabled Membership Screening',
            description: `No longer accepting request, all new member can join directly`,
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    MANAGED_ROLE: (data: Message | Interaction, role: Role) => {
        return makeErrorEmbed ({
            title: 'You cannot use this role',
            description: '``' + role.name +'``' + ' is managed by external service and cannot be used',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    CONFIGURED_ROLE: (data: Message | Interaction, role: Role) => {
        return makeSuccessEmbed ({
            title: 'Configured Membership Screening Role',
            description: 'New member will be given a ' + '``' + role.name +'``' + ' role after approval',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    CONFIGURED_CHANNEL: (data: Message | Interaction, channel: GuildChannel) => {
        return makeSuccessEmbed ({
            title: 'Configured Membership Screening Role',
            description: 'Anyone with ``VIEW_CHANNEL`` permission in ' + '``' + channel.name +'``' + ' can approve or deny request',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_CHANNEL: (data: Message | Interaction, channel: GuildChannel) => {
        return makeErrorEmbed ({
            title: 'Invalid channel type, only TextChannel is supported',
            description: '``' + channel.name +'``' + ' is not a text channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    INVALID_CHANNEL_THREAD: (data: Message | Interaction, channel: GuildChannel | ThreadChannel) => {
        return makeErrorEmbed ({
            title: 'Thread channel is not supported',
            description: '``' + channel.name +'``' + ' a thread channel. Please use regular channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    BOT_NO_PERMISSION: (data: Message | Interaction, channel: GuildChannel) => {
        return makeErrorEmbed ({
            title: `I don't have permission`,
            description: 'I cannot access/send message in ' + '``' + channel.name +'``',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_LONGER_VALID_ROLE: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'The configured role is no longer valid. Please update the role in configuration',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    CANNOT_PERFORM_ASSIGN_ROLE: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Cannot grant the role to user, make sure I have permission to do that',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    CANNOT_PERFORM_ASSIGN_KICK: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Cannot kick the user, make sure I have permission to do that',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    CANNOT_PERFORM_ASSIGN_BAN: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Cannot ban the user, make sure I have permission to do that',
            user: (data instanceof Interaction) ? data.user : data.author
        })
    },
    CREATE_MESSAGE: () => {
        return makeInfoEmbed ({
            icon: '👋',
            title: 'Welcome to this server!',
            description: `This server have membership screening enabled, **you'll have access to the server when the moderators let you in**.\n\nAlso please make sure that you acknowledged the common rules that everyone should be doing no matter where, Discord ToS (https://discordapp.com/terms)`,
            user: DiscordProvider.client.user
        })
    }
}

export default class MembershipScreening {

    async onCommand(command: string, args: any, message: Message) {
        
        if(command.toLowerCase() !== 'membershipscreening' && command.toLowerCase() !== 'ms') return;
        await this.process(message, args);
    }

    async process(data: Interaction | Message, args: any) {
        
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        if(data.guild === null || data.guildId === null) return;
        
        const Guild = await Prisma.client.guild.findFirst({ where: { id: data.guildId }})
        if(!Guild) throw new Error('TODO: Handle if guild is not found');
        

        const funct = {
            enable: async(data: Message | Interaction)=> {
                if(!Guild.MembershipScreening_Enabled) {

                    if(Guild.MembershipScreening_GivenRole === null || Guild.MembershipScreening_ApprovalChannel == null)
                        return await this.sendResponse(data, { embeds: [EMBEDS.NO_PARAMETER(data)] });
    
                    await Prisma.client.guild.update({ where: { id: data.guildId! }, data: { MembershipScreening_Enabled: true }});
    
                    return await this.sendResponse(data, { embeds: [EMBEDS.ENABLED(data)] });
                }
    
                else
                    return await this.sendResponse(data, { embeds: [EMBEDS.ALREADY_ENABLED(data)] });
            },
            disable: async(data: Message | Interaction) => {
                if(Guild.MembershipScreening_Enabled) {
                    await Prisma.client.guild.update({ 
                        where: {id: data.guildId! },
                        data: {MembershipScreening_Enabled: false}
                    });
    
                    return await this.sendResponse(data, { embeds: [EMBEDS.DISABLED(data)] });
                }
                else
                    return await this.sendResponse(data, { embeds: [EMBEDS.ALREADY_DISABLED(data)] });
            },
            setRole: async(data: Message | Interaction) => {
                
                let role: Role | undefined;

                if(data instanceof Message) {
                    let _name: string;
                    if(typeof args[1] === 'undefined')
                        return await this.sendResponse(data, { embeds: [EMBEDS.NO_ROLE_MENTIONED(data)] });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");
                    role = data.mentions.roles.first() || data.guild!.roles.cache.find(role => role.name === _name);
                }
                else if(data instanceof CommandInteraction)
                    role = data.guild!.roles.cache.find(role => role.id === data.options.getRole('role')?.id);

                
                if(typeof role === 'undefined' || !role)
                    return await this.sendResponse(data, { embeds: [EMBEDS.NO_ROLE_FOUND(data)] });

                await Prisma.client.guild.update({ where: {id: data.guildId! }, data: {MembershipScreening_GivenRole: role.id}});

                if(role.managed)
                    return await this.sendResponse(data, { embeds: [EMBEDS.MANAGED_ROLE(data, role)] });

                return await this.sendResponse(data, { embeds: [EMBEDS.CONFIGURED_ROLE(data, role)] });
            },
            setChannel: async(data: Message | CommandInteraction) => {
            
                let channel;
                if(data instanceof Message) {
                    if(typeof args[1] === 'undefined')
                        return await this.sendResponse(data, { embeds: [EMBEDS.NO_CHANNEL_MENTIONED(data)] });
                    channel = data.mentions.channels.first();
                }
                else if(data instanceof CommandInteraction)
                    channel = data.options.getChannel('channel');

                if(!channel)
                    return await this.sendResponse(data, { embeds: [EMBEDS.NO_CHANNEL_FOUND(data)] });
                
                let TargetChannel = data.guild!.channels.cache.get(channel.id);
                if(typeof TargetChannel === 'undefined') return;

                if(TargetChannel instanceof ThreadChannel || TargetChannel.isThread())
                    return await this.sendResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL_THREAD(data, TargetChannel)] });

                if(!TargetChannel.isText())
                    return await this.sendResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL(data, TargetChannel)] });

                if(!(data!.guild!.me?.permissionsIn(TargetChannel).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.VIEW_CHANNEL])))
                    return await this.sendResponse(data, { embeds: [EMBEDS.BOT_NO_PERMISSION(data, TargetChannel)] });

                await Prisma.client.guild.update({ where: {id: data.guildId! }, data: { MembershipScreening_ApprovalChannel: channel.id }});
                return await this.sendResponse(data, { embeds: [EMBEDS.CONFIGURED_CHANNEL(data, TargetChannel)] }); 
            },
            createMessage: async(data: Message | CommandInteraction) => {
                return await this.sendResponse(data, { embeds: [EMBEDS.CREATE_MESSAGE()] });
            }
        }

        let query;

        if(isMessage) {
            if(data === null || !data.guildId || data.member === null || data.guild === null) return;
            if (!data.member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                return await this.sendResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });

            if(args.length === 0) {
                return await this.sendResponse(data, { embeds: [EMBEDS.MSINFO(data)] });
            }
            query = args[0].toLowerCase();

        }
        else if(isSlashCommand) {
            if(!data.guild.members.cache.get(data.user.id)?.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                return await this.sendResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });

            query = args.getSubcommand();
        }

        switch(query) {
            case "enable":
            case "on":
                return await funct.enable(data);
            case "disable":
            case "off":
                return await funct.disable(data);
            case "setrole":
                return await funct.setRole(data);
            case "setchannel":
                return await funct.setChannel(data as CommandInteraction);
            case "createmessage":
                return await funct.createMessage(data as CommandInteraction);
        }

    }

    async interactionCreate(interaction: Interaction) {

        if (interaction.isButton()) {

            if(!interaction.guild || !interaction.guildId) return;
            if(!(interaction.channel instanceof TextChannel)) return;
            if(!this.tryParseJSONObject(interaction.customId)) return;

            Logger.log('debug', `${interaction.user.username}#${interaction.user.discriminator} (UserID: ${interaction.user.id}) (InteractionID: ${interaction.id}) executed button interaction ${interaction.customId}`);

            let payload = JSON.parse(interaction.customId);

            if( typeof payload.module === 'undefined' ||
                typeof payload.action === 'undefined' ||
                payload.module !== 'MembershipScreening') return;

            const message = await interaction.channel.messages.fetch(interaction.message.id);
            if(typeof message === 'undefined') return;

            const embed = message.embeds;
            if(typeof embed === 'undefined' || embed.length === 0) return;

            const Guild = await Prisma.client.guild.findFirst({ where: { id: interaction.guildId } });
            if(!Guild) throw new Error('TODO: Handle if guild is not found');
    
            if(!Guild.MembershipScreening_Enabled ||
                Guild.MembershipScreening_ApprovalChannel === null ||
                Guild.MembershipScreening_GivenRole === null) return;

            embed[0].setFooter(`${interaction.user.username}  |  v${App.version}`, (interaction.user.avatarURL() || ''));

            if(['approve', 'deny', 'ban'].includes(payload.action)) {
                
                if(!payload.data.requester) return;
                let role = (await interaction.guild.roles.fetch()).find(role => role.id === Guild.MembershipScreening_GivenRole);
                let member = (await interaction.guild.members.fetch()).find(member => member.id === payload.data.requester);

                if(!role)
                    return await interaction.reply({ ephemeral: true, embeds: [EMBEDS.NO_LONGER_VALID_ROLE(interaction)]});

                if(!member) {
                    embed[0].addField("❌ Invalid", `Unable to find the user. User left already?`);
                    return await message.edit({ components: [], embeds: embed });
                }

                if(member.roles.cache.has(Guild.MembershipScreening_GivenRole)) {
                    embed[0].addField("✅ Approved", `By: Unknown (User already obtained the role by other means)`);
                    return await message.edit({ components: [], embeds: embed });
                }

                if(payload.action === 'approve') {
                    try {
                        await member.roles.add(role);
                        embed[0].addField("✅ Approved", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                        await message.edit({ components: [], embeds: embed });
                    }
                    catch(err) {
                        return interaction.reply({ ephemeral: true, embeds: [EMBEDS.CANNOT_PERFORM_ASSIGN_ROLE(message)]});
                    }
                }

                else if(payload.action === 'deny') { 
                    try { 
                        await member.kick(); 
                        embed[0].addField("❌ Denied", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                        await message.edit({ components: [], embeds: embed });
                    } 
                    catch(err) {
                        return interaction.reply({ ephemeral: true, embeds: [EMBEDS.CANNOT_PERFORM_ASSIGN_KICK(message)]});
                    }
                }

                else if(payload.action === 'ban') {
                    try {
                        await member.ban({
                            reason: `Membership Screening, action issued by ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`
                        });
                        embed[0].addField("🔪 Banned", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                        await message.edit({ components: [], embeds: embed });
                    }
                    catch(err) {
                        return interaction.reply({ ephemeral: true, embeds: [EMBEDS.CANNOT_PERFORM_ASSIGN_BAN(message)]});
                    }
                }

            }
        }

        else if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'membershipscreening') return;
            await this.process(interaction, interaction.options);
        }
    }

    async guildMemberAdd(member: GuildMember) {

        if(member.user.bot) return;

        const Guild = await Prisma.client.guild.findFirst({ where: { id: member.guild.id } });
        if(!Guild) return;

        if(!Guild.MembershipScreening_Enabled) return;
        if(Guild.MembershipScreening_ApprovalChannel === null) return;
        if(Guild.MembershipScreening_GivenRole === null) return;

        const channel = await DiscordProvider.client.channels.fetch(Guild.MembershipScreening_ApprovalChannel) as TextChannel;
        if(!channel) return;

        const embed = makeInfoEmbed ({
            title: 'New member joined!',
            description: `${member.user.username}#${member.user.discriminator} (${member.user.id})`,
            fields: [
                {
                    name: "Account Information",
                    value: `Account age: <t:${Math.round(member.user.createdAt.getTime() / 1000)}:R>`
                }
            ]
        });

        embed.setThumbnail(member.user.avatarURL() || '');
    
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(JSON.stringify({
                        module: 'MembershipScreening',
                        action: 'approve',
                        data: {
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
                        module: 'MembershipScreening',
                        action: 'deny',
                        data: {
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
                        module: 'MembershipScreening',
                        action: 'ban',
                        data: {
                            requester: member.id
                        }
                    }))
                    .setEmoji('🔪')
                    .setLabel('  Vision Hunt Decree (Ban)')
                    .setStyle('DANGER'),
            )

        await channel.send({ content: '\u200b', embeds: [embed], components: [row] });
    }

    tryParseJSONObject(jsonString: string) {
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

    async sendResponse(data: Message | Interaction, payload: any) {
        const isSlashCommand = data instanceof Interaction && data.isCommand();
        const isMessage = data instanceof Message;

        if(isSlashCommand) return await data.reply(payload);
        else if(isMessage) return await sendReply(data, payload);
    }
}