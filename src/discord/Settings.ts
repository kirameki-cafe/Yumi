import { Message, Interaction, CommandInteraction, Permissions, ThreadChannel, GuildChannel } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import Prisma from "../providers/Prisma";
import Cache from "../providers/Cache";

const EMBEDS = {
    SETTINGS_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Settings',
            description: `Change how ${DiscordProvider.client.user?.username} behave on **${data.guild?.name}**`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``setPrefix`` ``setEnableServiceAnnouncement`` ``setServiceAnnouncementChannel``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PROCESSING: (data: Message | Interaction) => {
        return makeProcessingEmbed({
            icon: (data instanceof Message) ? undefined : '⌛',
            title: `Performing actions`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_PERMISSION: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'You need ``ADMINISTRATOR`` permission on this guild!',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_PREFIX_PROVIDED: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'No prefix provided',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SERVICE_ANNOUNCEMENT_INVALID_STATUS: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Invalid status, Use ``true`` or ``false``',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED: async (data: Message | Interaction) => {
        let GuildCache = await Cache.getGuild(data.guildId!);

        // TODO: Better error handling
        if(typeof GuildCache === 'undefined')
            throw new Error('Guild not found');
            
        return makeInfoEmbed ({
            title: 'Service Announcement',
            description: `Service Announcement is ${GuildCache.ServiceAnnouncement_Enabled ? "**enabled**" : "**disabled**"} on this server`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PREFIX_TOO_LONG: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Prefix too long',
            description: `I bet you can't even remember that`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PREFIX_IS_MENTION: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Prefix cannot be mention of me',
            description: `You can already call me by mentioning me. I got that covered, don't worry`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PREFIX_UPDATED: (data: Message | Interaction, newPrefix: string) => {
        return makeSuccessEmbed ({
            title: 'Prefix Updated',
            description: `From now onwards, I shall be called by using \`\`${newPrefix}\`\``,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SERVICE_ANNOUNCEMENT_STATUS_UPDATED: (data: Message | Interaction, newStatus: boolean) => {
        return makeSuccessEmbed ({
            title: `Service Announcement is now ${newStatus ? "enabled" : "disabled"}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SERVICE_ANNOUNCEMENT_STATUS_ALREADY_SET: (data: Message | Interaction, status: boolean) => {
        return makeInfoEmbed ({
            title: `Service Announcement is already ${status ? "enabled" : "disabled"}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SERVICE_ANNOUNCEMENT_NO_PARAMETER: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'Missing parameter',
            description: `You must define service announcement channel to enable this feature`,
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
            description: '``' + channel.name +'``' + ' is a thread channel. Please use a regular text channel',
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
    SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL: (data: Message | Interaction, channel: GuildChannel) => {
        return makeSuccessEmbed ({
            title: 'Configured Service Announcement Channel',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
}

export default class Settings {
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'settings') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'settings') return;
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
            setPrefix: async(data: Message | Interaction) => {

                if(data === null || !data.guildId || data.member === null || data.guild === null) return;

                if(data instanceof Message) {
                    if (!data.member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });
                }
                else if(isSlashCommand) {
                    if(!data.guild.members.cache.get(data.user.id)?.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });
                }
        

                let newPrefix: string | undefined;
                if(data instanceof Message) {
                    let _name: string;
                    if(typeof args[1] === 'undefined')
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PREFIX_PROVIDED(data)] });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");
                    newPrefix = _name;
                }
                else if(data instanceof CommandInteraction)
                    newPrefix = data.options.getString('prefix')!;

                if(!newPrefix)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PREFIX_PROVIDED(data)] });

                if(newPrefix.length > 200)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PREFIX_TOO_LONG(data)] });

                if(newPrefix.startsWith(`<@!${DiscordProvider.client.user?.id}>`))
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PREFIX_IS_MENTION(data)] });

                let placeholder = await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });

                await Prisma.client.guild.update({ where: { id: data.guildId! }, data: { prefix: newPrefix }});
                Cache.updateGuildCache(data.guildId!);

                if(isMessage)
                    return await (placeholder as Message).edit({ embeds: [EMBEDS.PREFIX_UPDATED(data, newPrefix)] });
                else if(isSlashCommand)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PREFIX_UPDATED(data, newPrefix)]}, true);
            },
            setEnableServiceAnnouncement: async(data: Message | Interaction) => {

                if(data === null || !data.guildId || data.member === null || data.guild === null) return;

                if(data instanceof Message) {
                    if (!data.member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });
                }
                else if(isSlashCommand) {
                    if(!data.guild.members.cache.get(data.user.id)?.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data)] });
                }
        

                let newStatus: string | undefined;
                if(data instanceof Message) {
                    let _name: string;
                    if(typeof args[1] === 'undefined') {
                        return await sendMessageOrInteractionResponse(data, { embeds: [await EMBEDS.NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED(data)] });
                    }

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");
                    newStatus = _name;
                }
                else if(data instanceof CommandInteraction)
                    newStatus = data.options.getString('status')!;

                if(!newStatus)
                    return await sendMessageOrInteractionResponse(data, { embeds: [await EMBEDS.NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED(data)] });

                if(!["true", "false", "yes", "no", "y", "n", "enable", "disable"].includes(newStatus.toLowerCase()))
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_INVALID_STATUS(data)] });

                await Cache.updateGuildCache(data.guildId!);
                let GuildCache = await Cache.getGuild(data.guildId!);

                const newStatusBool = ["true", "yes", "y", "enable"].includes(newStatus.toLowerCase()) ? true : false;

                if(GuildCache?.ServiceAnnouncement_Enabled === newStatusBool)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_ALREADY_SET(data, newStatusBool)] });

                if(GuildCache?.ServiceAnnouncement_Channel === null)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_NO_PARAMETER(data)] });

                let placeholder = await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });

                await Prisma.client.guild.update(
                    { where: { id: data.guildId! },
                    data: { 
                        ServiceAnnouncement_Enabled: newStatusBool
                    }
                });
                Cache.updateGuildCache(data.guildId!);

                if(isMessage)
                    return await (placeholder as Message).edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_UPDATED(data, newStatusBool)]});
                else if(isSlashCommand)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_UPDATED(data, newStatusBool)]}, true);
            },
            setServiceAnnouncementChannel: async(data: Message | CommandInteraction) => {
            
                let channel;
                if(data instanceof Message) {
                    if(typeof args[1] === 'undefined')
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_CHANNEL_MENTIONED(data)] });
                    channel = data.mentions.channels.first();
                }
                else if(data instanceof CommandInteraction)
                    channel = data.options.getChannel('channel');

                if(!channel)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_CHANNEL_FOUND(data)] });
                
                let TargetChannel = data.guild!.channels.cache.get(channel.id);
                if(typeof TargetChannel === 'undefined') return;

                if(TargetChannel instanceof ThreadChannel || TargetChannel.isThread())
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL_THREAD(data, TargetChannel)] });

                if(!TargetChannel.isText())
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL(data, TargetChannel)] });

                if(!(data!.guild!.me?.permissionsIn(TargetChannel).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.VIEW_CHANNEL])))
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.BOT_NO_PERMISSION(data, TargetChannel)] });

                let placeholder = await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });

                await Prisma.client.guild.update({ where: {id: data.guildId! }, data: { ServiceAnnouncement_Channel: channel.id }});

                if(isMessage)
                    return await (placeholder as Message).edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL(data, TargetChannel)]});
                else if(isSlashCommand)
                    return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL(data, TargetChannel)]}, true);
            }
        }

        let query;

        if(isMessage) {
            if(data === null || !data.guildId || data.member === null || data.guild === null) return;
            
            if(args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SETTINGS_INFO(data)] });
            }
            query = args[0].toLowerCase();

        }
        else if(isSlashCommand) {
            query = args.getSubcommand();
        }

        switch(query) {
            case "info":
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SETTINGS_INFO(data)] });
            case "setprefix":
                return await funct.setPrefix(data);
            case "setenableserviceannouncement":
                return await funct.setEnableServiceAnnouncement(data);
            case "setserviceannouncementchannel":
                return await funct.setServiceAnnouncementChannel(data);
        }

    }
}