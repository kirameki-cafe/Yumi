import DiscordModule, { HybridInteractionMessage } from "../utils/DiscordModule";

import { Message, Interaction, CommandInteraction, Permissions, ThreadChannel, GuildChannel } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, sendHybridInteractionMessageResponse } from "../utils/DiscordMessage";
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
    PROCESSING: (data: HybridInteractionMessage) => {
        return makeProcessingEmbed({
            icon: (data.isMessage()) ? undefined : '⌛',
            title: `Performing actions`,
            user: data.getUser()
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
        let GuildCache = await Cache.getGuild(data.guild!.id);

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

export default class Settings extends DiscordModule {

    public id = "Discord_Settings";
    public commands = ["settings"];
    public commandInteractionName = "settings";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) { 
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        
        const Guild = await Prisma.client.guild.findFirst({ where: { id: data.getGuild()!.id }})
        if(!Guild) return;

        const funct = {
            setPrefix: async(data: HybridInteractionMessage) => {

                let member = data.getMember();
                if(!member) return;

                if (!member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data.getRaw())] });

                let newPrefix: string | null | undefined;
                if(data.isMessage()) {
                    let _name: string;
                    if(typeof args[1] === 'undefined')
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PREFIX_PROVIDED(data.getRaw())] });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");
                    newPrefix = _name;
                }
                else if(data.isSlashCommand())
                    newPrefix = data.getSlashCommand().options.getString('prefix');

                if(!newPrefix)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PREFIX_PROVIDED(data.getRaw())] });

                if(newPrefix.length > 200)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PREFIX_TOO_LONG(data.getRaw())] });

                if(newPrefix.startsWith(`<@!${DiscordProvider.client.user?.id}>`))
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PREFIX_IS_MENTION(data.getRaw())] });

                let placeholder: (HybridInteractionMessage | undefined);

                let _placeholder = await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });
                if (_placeholder)
                    placeholder = new HybridInteractionMessage(_placeholder);

                await Prisma.client.guild.update({ where: { id: data.getGuild()!.id }, data: { prefix: newPrefix }});
                Cache.updateGuildCache(data.getGuild()!.id);

                if(data && data.isMessage() && placeholder && placeholder.isMessage())
                    return placeholder.getMessage().edit({ embeds: [EMBEDS.PREFIX_UPDATED(data.getRaw(), newPrefix)] });
                else if(data.isSlashCommand())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PREFIX_UPDATED(data.getRaw(), newPrefix)]}, true);
            },
            setEnableServiceAnnouncement: async(data: HybridInteractionMessage) => {

                let member = data.getMember();
                if(!member) return;

                if (!member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data.getRaw())] });

                let newStatus: string | null | undefined;
                if(data.isMessage()) {
                    let _name: string;
                    if(typeof args[1] === 'undefined') 
                        return await sendHybridInteractionMessageResponse(data, { embeds: [await EMBEDS.NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED(data.getRaw())] });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(" ");
                    newStatus = _name;
                }
                else if(data.isSlashCommand())
                    newStatus = data.getSlashCommand().options.getString('status')!;

                if(!newStatus)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [await EMBEDS.NO_SERVICE_ANNOUNCEMENT_STATUS_PROVIDED(data.getRaw())] });

                if(!["true", "false", "yes", "no", "y", "n", "enable", "disable"].includes(newStatus.toLowerCase()))
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_INVALID_STATUS(data.getRaw())] });

                await Cache.updateGuildCache(data.getGuild()!.id);
                let GuildCache = await Cache.getGuild(data.getGuild()!.id);

                const newStatusBool = ["true", "yes", "y", "enable"].includes(newStatus.toLowerCase()) ? true : false;

                if(GuildCache?.ServiceAnnouncement_Enabled === newStatusBool)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_ALREADY_SET(data.getRaw(), newStatusBool)] });

                if(GuildCache?.ServiceAnnouncement_Channel === null)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_NO_PARAMETER(data.getRaw())] });

                let placeholder = await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });

                await Prisma.client.guild.update(
                    { where: { id: data.getGuild()!.id },
                    data: { 
                        ServiceAnnouncement_Enabled: newStatusBool
                    }
                });
                Cache.updateGuildCache(data.getGuild()!.id);

                if(data.isMessage())
                    return await (placeholder as Message).edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_UPDATED(data.getRaw(), newStatusBool)]});
                else if(data.isSlashCommand())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_STATUS_UPDATED(data.getRaw(), newStatusBool)]}, true);
            },
            setServiceAnnouncementChannel: async(data: HybridInteractionMessage) => {
            
                let member = data.getMember();
                if(!member) return;

                if (!member.permissions.has([Permissions.FLAGS.ADMINISTRATOR]))
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_PERMISSION(data.getRaw())] });
                
                let channel;
                if(data.isMessage()) {
                    if(typeof args[1] === 'undefined')
                        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_CHANNEL_MENTIONED(data.getRaw())] });
                    channel = data.getMessage().mentions.channels.first();
                }
                else if(data.isSlashCommand())
                    channel = data.getSlashCommand().options.getChannel('channel');

                if(!channel)
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_CHANNEL_FOUND(data.getRaw())] });
                
                let TargetChannel = data.getGuild()!.channels.cache.get(channel.id);
                if(typeof TargetChannel === 'undefined') return;

                if(TargetChannel instanceof ThreadChannel || TargetChannel.isThread())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL_THREAD(data.getRaw(), TargetChannel)] });

                if(!TargetChannel.isText())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INVALID_CHANNEL(data.getRaw(), TargetChannel)] });

                if(!(data.getGuild()!.me?.permissionsIn(TargetChannel).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.VIEW_CHANNEL])))
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.BOT_NO_PERMISSION(data.getRaw(), TargetChannel)] });

                let placeholder = await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PROCESSING(data)] });

                await Prisma.client.guild.update({ where: {id: data.getGuild()!.id }, data: { ServiceAnnouncement_Channel: channel.id }});

                if(data.isMessage())
                    return await (placeholder as Message).edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL(data.getRaw(), TargetChannel)]});
                else if(data.isSlashCommand())
                    return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_CONFIGURED_CHANNEL(data.getRaw(), TargetChannel)]}, true);
            }
        }

        let query;

        if(data.isMessage()) {
            if(args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SETTINGS_INFO(data.getRaw())] });
    
            query = args[0].toLowerCase();
        }
        else if(data.isSlashCommand()) {
            query = args.getSubcommand();
        }

        switch(query) {
            case "info":
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SETTINGS_INFO(data.getRaw())] });
            case "setprefix":
                return await funct.setPrefix(data);
            case "setenableserviceannouncement":
                return await funct.setEnableServiceAnnouncement(data);
            case "setserviceannouncementchannel":
                return await funct.setServiceAnnouncementChannel(data);
        }

    }
}