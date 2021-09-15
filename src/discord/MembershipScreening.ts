import { channel } from "diagnostics_channel";
import { GuildChannel, GuildMember, Message, Permissions, TextChannel, MessageActionRow, MessageButton, Interaction } from "discord.js";
import App from "..";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, makeInfoEmbed, makeErrorEmbed, sendMessage, sendReply } from "../libs/DiscordMessage";
import Logger from "../libs/Logger";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";

export default class MembershipScreening {

    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'membershipscreening' && command.toLowerCase() !== 'ms') return;

        if(!message.guildId) return;
        if(message.member === null) return;
        if(message.guild === null) return;

        if (!message.member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
            return await sendReply(message, {
                embeds: [makeErrorEmbed ({
                    title: 'You need ``ADMINISTRATOR`` permission on this guild!',
                    user: message.author
                })]
            });

        if(args.length === 0) {
            return await sendReply(message, {
                embeds: [makeInfoEmbed ({
                    title: 'Membership Screening',
                    description: `Membership Screening is a feature to prevent unwanted people to join your guild, similar to whitelist feature. Moderators can approve or deny join request`,
                    fields: [
                        {
                            name: 'Available arguments',
                            value: '``setRole`` ``setChannel`` ``createMessage``'
                        }
                    ],
                    user: message.author
                })]
            });
        } else {

            const Guild = await Prisma.client.guild.findFirst({ where: {id: message.guildId }})
            if(!Guild) throw new Error('TODO: Handle if guild is not found');

            if(args[0].toLowerCase() === "enable" || args[0].toLowerCase() === "on") {
                if(!Guild.MembershipScreening_Enabled) {
                    if(Guild.MembershipScreening_GivenRole === null || Guild.MembershipScreening_ApprovalChannel == null) {
                        return await sendReply(message, {
                            embeds: [makeErrorEmbed ({
                                title: 'Missing parameter',
                                description: `You must define membership screening channel and role to enable this feature`,
                                user: message.author
                            })]
                        });
                    }
                    await Prisma.client.guild.update({ 
                        where: {id: message.guildId },
                        data: {MembershipScreening_Enabled: true}
                    });
                    return await sendReply(message, {
                        embeds: [makeSuccessEmbed ({
                            title: 'Enabled Membership Screening',
                            description: `All new member join request will be sent in your defined channel`,
                            user: message.author
                        })]
                    });
                }
                else
                    return await sendReply(message, {
                        embeds: [makeInfoEmbed ({
                            title: 'Membership Screening is already enabled',
                            user: message.author
                        })]
                    });
            }
            else if(args[0].toLowerCase() === "disable" || args[0].toLowerCase() === "off") {
                if(Guild.MembershipScreening_Enabled) {
                    await Prisma.client.guild.update({ 
                        where: {id: message.guildId },
                        data: {MembershipScreening_Enabled: false}
                    });
                    return await sendReply(message, {
                        embeds: [makeSuccessEmbed ({
                            title: 'Disabled Membership Screening',
                            description: `No longer accepting request, all new member can join directly`,
                            user: message.author
                        })]
                    });
                }
                else
                    return await sendReply(message, {
                        embeds: [makeInfoEmbed ({
                            title: 'Membership Screening is already disabled',
                            user: message.author
                        })]
                    });
            }
            else if(args[0].toLowerCase() === "setrole") {
                if(typeof args[1] === 'undefined')
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'No role mentioned',
                            user: message.author
                        })]
                    });

                let _name = args;
                _name.shift();
                let role = message.mentions.roles.first() || message.guild.roles.cache.find(role => role.name === _name.join(" "));

                if(!role)
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'Cannot find that role',
                            user: message.author
                        })]
                    });

                await Prisma.client.guild.update({ 
                    where: {id: message.guildId },
                    data: {MembershipScreening_GivenRole: role.id}
                });

                if(role.managed)
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'That role cannot be used',
                            description: '``' + role.name +'``' + ' is managed by external service and cannot be used',
                            user: message.author
                        })]
                    });

                return await sendReply(message, {
                    embeds: [makeSuccessEmbed ({
                        title: 'Configured Membership Screening Role',
                        description: 'New member will be given a ' + '``' + role.name +'``' + ' role after approval',
                        user: message.author
                    })]
                });
            }
            else if(args[0].toLowerCase() === "setchannel") {
                if(typeof args[1] === 'undefined')
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'No channel mentioned',
                            user: message.author
                        })]
                    });

                let _name = args;
                 _name.shift();
                let channel = message.mentions.channels.first();

                if(!channel)
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'Cannot find that channel',
                            user: message.author
                        })]
                    });
                
                let TargetChannel = message.guild.channels.cache.get(channel.id)

                if(!channel.isText)
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: 'Invalid channel type',
                            description: '``' + TargetChannel?.name +'``' + ' is not a text channel',
                            user: message.author
                        })]
                    });

                TargetChannel = message.guild.channels.cache.get(channel.id) as GuildChannel;

                if(!message.guild.me?.permissionsIn(TargetChannel).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.VIEW_CHANNEL]))
                    return await sendReply(message, {
                        embeds: [makeErrorEmbed ({
                            title: `I don't have permission`,
                            description: 'I cannot access/send message in ' + '``' + TargetChannel?.name +'``',
                            user: message.author
                        })]
                    });

                await Prisma.client.guild.update({ 
                    where: {id: message.guildId },
                    data: {MembershipScreening_ApprovalChannel: channel.id}
                });

                return await sendReply(message, {
                    embeds: [makeSuccessEmbed ({
                        title: 'Configured Membership Screening Channel',
                        description: 'Anyone with ``VIEW_CHANNEL`` permission in ' + '``' + TargetChannel?.name +'``' + ' can approve or deny request',
                        user: message.author
                    })]
                });

                
            }
            else if(args[0].toLowerCase() === "createmessage") {
                return await sendMessage(message.channel, undefined, {
                    embeds: [makeInfoEmbed ({
                        icon: '👋',
                        title: 'Welcome to this server!',
                        description: `This server have membership screening enabled, **you'll have access to the server when the moderators let you in**.\n\nAlso please make sure that you acknowledged the common rules that everyone should be doing no matter where, Discord ToS (https://discordapp.com/terms)`,
                        user: DiscordProvider.client.user
                    })]
                });
            }
        }

    }

    async interactionCreate(interaction: Interaction) {
        if (interaction.isButton()) {

            if(!(interaction.channel instanceof TextChannel)) return;
            if(!this.tryParseJSONObject(interaction.customId)) return;

            Logger.log('debug', `${interaction.user.username}#${interaction.user.discriminator} (UserID: ${interaction.user.id}) (InteractionID: ${interaction.id}) executed button interaction ${interaction.customId}`);

            let payload = JSON.parse(interaction.customId);

            if(typeof payload.module === 'undefined' || typeof payload.action === 'undefined') return;
            if(payload.module !== 'MembershipScreening') return;

            const message = await interaction.channel.messages.fetch(interaction.message.id);
            if(typeof message === 'undefined') return;

            const embed = message.embeds;
            if(typeof embed === 'undefined' || embed.length === 0) return;

            if(!interaction.guild || !interaction.guildId) return;

            const Guild = await Prisma.client.guild.findFirst({ where: { id: interaction.guildId } });
            if(!Guild) return;
    
            if(!Guild.MembershipScreening_Enabled || Guild.MembershipScreening_ApprovalChannel === null || Guild.MembershipScreening_GivenRole === null) return;

            embed[0].setFooter(`${interaction.user.username}  |  v${App.version}`, (interaction.user.avatarURL() || ''));

            if(['approve', 'deny', 'ban'].includes(payload.action)) {
                if(!payload.data.requester) return;
                let role = (await interaction.guild.roles.fetch()).find(role => role.id === Guild.MembershipScreening_GivenRole);
                let member = (await interaction.guild.members.fetch()).find(member => member.id === payload.data.requester);

                if(!role) {
                    return interaction.reply({ ephemeral: true, embeds: [makeErrorEmbed ({
                        title: 'Unable to find role to give to. Please update your role in settings',
                        user: message.author
                    })]});
                }

                if(!member) {
                    embed[0].addField("❌ Invalid", `Unable to find the user. User left already?`);
                    await message.edit({ components: [], embeds: embed});
                    return;
                }

                if(member.roles.cache.has(Guild.MembershipScreening_GivenRole)) {
                    embed[0].addField("✅ Approved", `By: Unknown (User already obtained the role by other means)`);
                    await message.edit({ components: []});
                    return;
                }

                if(payload.action === 'approve') {
                    try {
                        await member.roles.add(role);
                        embed[0].addField("✅ Approved", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                        await message.edit({ components: []});
                    }
                    catch(err) {
                        return interaction.reply({ ephemeral: true, embeds: [makeErrorEmbed ({
                            title: 'Unable to give role to user, make sure I have permission to do that',
                            user: message.author
                        })]});
                    }    
                    await message.edit({ embeds: embed});
                }
                else if(payload.action === 'deny') { 
                    try { 
                        await member.kick(); 
                        embed[0].addField("❌ Denied", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                        await message.edit({ components: []});
                    } 
                    catch(err) {
                        return interaction.reply({ ephemeral: true, embeds: [makeErrorEmbed ({
                            title: 'Unable to kick user, make sure I have permission to do that',
                            user: message.author
                        })]});
                    }
                    await message.edit({ embeds: embed});
                }
                else if(payload.action === 'ban') {
                    try {
                        await member.ban({
                            reason: `Membership Screening, action issued by ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`
                        });
                        embed[0].addField("🔪 Banned", `By: ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id})`);
                        await message.edit({ components: []});
                    }
                    catch(err) {
                        return interaction.reply({ ephemeral: true, embeds: [makeErrorEmbed ({
                            title: 'Unable to ban user, make sure I have permission to do that',
                            user: message.author
                        })]});
                    }
                    await message.edit({ embeds: embed});
                }

            }
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
                    .setEmoji('😔')
                    .setLabel('  Deny')
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
                    .setLabel('  Ban')
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
    };
}