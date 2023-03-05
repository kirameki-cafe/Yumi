import { Message, EmbedBuilder, CommandInteraction, TextChannel, EmbedData } from 'discord.js';
import { Promise } from 'bluebird';
import fs from 'fs';
import path from 'path';

import { Guild } from '@prisma/client';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    makeSuccessEmbed,
    makeProcessingEmbed,
    makeWarningEmbed,
    sendHybridInteractionMessageResponse,
    sendMessage
} from '../../utils/DiscordMessage';

import Logger from '../../libs/Logger';
import DiscordProvider from '../../providers/Discord';
import Prisma from '../../providers/Prisma';
import Users from '../../services/Users';

const hexToDecimal = (hex: string) => parseInt(hex.replace('#', ''), 16);

const EMBEDS = {
    ANNOUNCEMENT_INFO: (data: HybridInteractionMessage) => {
        return makeInfoEmbed({
            title: 'Service Announcement',
            description: `This module contains management tool for announcement feed\n The announcement message is located in \`\`configs/ServiceAnnouncement.json\`\``,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``Reload`` ``PreviewNews`` ``SendNews`` ``PreviewMaintenance`` ``SendMaintenance`` ``PreviewMessage`` ``SendMessage`` ``PreviewAlert`` ``SendAlert``'
                }
            ],
            user: data.getUser()
        });
    },
    NOT_DEVELOPER: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: 'Developer only',
            description: `This command is restricted to the developers only`,
            user: data.getUser()
        });
    },
    MAKE_PAYLOAD: (payload: EmbedData) => {
        const user = DiscordProvider.client.user;
        payload.footer = {
            text: `${user?.username}`,
            iconURL: `${user?.displayAvatarURL()}?size=4096`
        };

        if (!payload.timestamp) payload.timestamp = Date.now();

        if (payload.thumbnail?.url === 'bot_avatar') payload.thumbnail.url = `${user?.displayAvatarURL()}?size=4096`;

        if (payload.image?.url === 'bot_avatar') payload.image.url = `${user?.displayAvatarURL()}?size=4096`;

        if (payload.description)
            payload.description = payload.description.replaceAll('{bot_username}', user?.username!);

        if (payload.color && isNaN(payload.color)) payload.color = hexToDecimal(payload.color.toString());

        return new EmbedBuilder(payload);
    },
    RELOADED: (data: HybridInteractionMessage) => {
        return makeSuccessEmbed({
            title: 'Service Announcement Configuration Reloaded',
            user: data.getUser()
        });
    },
    RELOAD_ERROR: (data: HybridInteractionMessage, error: string) => {
        return makeErrorEmbed({
            title: 'Unable to reload Service Announcement Configuration',
            description: `\`\`\`${error}\`\`\``,
            user: data.getUser()
        });
    },
    SENDING_SERVICE_ANNOUNCEMENT: (data: HybridInteractionMessage) => {
        return makeProcessingEmbed({
            title: 'Service Announcement',
            description: `Broadcasting Service Announcement`,
            user: data.getUser()
        });
    },
    SERVICE_ANNOUNCEMENT_SENT: (data: HybridInteractionMessage) => {
        return makeSuccessEmbed({
            title: 'Service Announcement',
            description: `Broadcasted Service Announcement`,
            user: data.getUser()
        });
    },
    SERVICE_ANNOUNCEMENT_SENT_WITH_ERRORS: (data: HybridInteractionMessage) => {
        return makeWarningEmbed({
            title: 'Service Announcement',
            description: `Broadcasted Service Announcement with errors, check console for more info`,
            user: data.getUser()
        });
    }
};

let Announcements = {
    News: {
        color: hexToDecimal('#FAEDF0'),
        title: '📰 Newsletter',
        description: 'Some description here',
        thumbnail: {
            url: 'bot_avatar'
        }
    },
    Maintenance: {
        color: hexToDecimal('#383b80'),
        title: '🔧 Maintenance',
        description: 'The bot is going offline for maintenance.',
        thumbnail: {
            url: 'bot_avatar'
        }
    },
    Message: {
        color: hexToDecimal('#A1DE93'),
        title: '✉️ Message',
        description: 'Some description here',
        thumbnail: {
            url: 'bot_avatar'
        }
    },
    Alert: {
        color: hexToDecimal('#EC255A'),
        title: '🚨 Alert',
        description: 'Some description here',
        thumbnail: {
            url: 'bot_avatar'
        }
    }
};
export default class ServiceAnnouncement extends DiscordModule {
    public id = 'Discord_Developer_ServiceAnnouncement';
    public commands = ['serviceannouncement'];
    public commandInteractionName = 'serviceannouncement';

    async Init() {
        if (fs.existsSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'))) {
            try {
                const rawData = fs.readFileSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'));
                const jsonData = JSON.parse(rawData.toString());
                Announcements = jsonData;
            } catch (err) {
                Logger.error('Unable to load custom ServiceAnnouncement config: ' + err);
            }
        }
    }

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        if (!Users.isDeveloper(data.getUser()!.id))
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NOT_DEVELOPER(data)]
            });

        const channel = data.getChannel();
        if (!channel) return;

        const funct = {
            reload: async (data: HybridInteractionMessage) => {
                if (fs.existsSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'))) {
                    try {
                        const rawData = fs.readFileSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'));
                        const jsonData = JSON.parse(rawData.toString());
                        Announcements = jsonData;
                    } catch (err: any) {
                        Logger.error('Unable to load custom ServiceAnnouncement config: ' + err);
                        return await sendMessage(channel, undefined, {
                            embeds: [EMBEDS.RELOAD_ERROR(data, err)]
                        });
                    }
                } else {
                    fs.writeFileSync(
                        path.join(process.cwd(), 'configs/ServiceAnnouncement.json'),
                        JSON.stringify(Announcements, null, 4),
                        'utf8'
                    );
                }

                return await sendMessage(channel, undefined, {
                    embeds: [EMBEDS.RELOADED(data)]
                });
            },
            previewNews: async (data: HybridInteractionMessage) => {
                return await sendMessage(channel, undefined, {
                    embeds: [EMBEDS.MAKE_PAYLOAD(Announcements.News)]
                });
            },
            previewMaintenance: async (data: HybridInteractionMessage) => {
                return await sendMessage(channel, undefined, {
                    embeds: [EMBEDS.MAKE_PAYLOAD(Announcements.Maintenance)]
                });
            },
            previewMessage: async (data: HybridInteractionMessage) => {
                return await sendMessage(channel, undefined, {
                    embeds: [EMBEDS.MAKE_PAYLOAD(Announcements.Message)]
                });
            },
            previewAlert: async (data: HybridInteractionMessage) => {
                return await sendMessage(channel, undefined, {
                    embeds: [EMBEDS.MAKE_PAYLOAD(Announcements.Alert)]
                });
            },
            publishServiceAnnouncement: async (data: HybridInteractionMessage, embed: any) => {
                const Guilds = await Prisma.client.guild.findMany({});
                const toSend = new Map();

                let withError = false;

                for (const Guild of Guilds) {
                    if (!Guild.ServiceAnnouncement_Enabled) continue;
                    if (Guild.ServiceAnnouncement_Channel === null) continue;

                    let channel = undefined;
                    try {
                        channel = (await DiscordProvider.client.channels.fetch(
                            Guild.ServiceAnnouncement_Channel
                        )) as TextChannel;
                    } catch (err) {
                        withError = true;
                        const guildObject = DiscordProvider.client.guilds.cache.get(Guild.id);
                        Logger.warn(
                            `Unable to find channel for Service Announcement to ${guildObject?.name} (${Guild.id}) (Channel ID: ${Guild.ServiceAnnouncement_Channel})`
                        );
                        continue;
                    }

                    if (!channel) continue;
                    toSend.set(Guild, channel);
                }

                let placeholder: HybridInteractionMessage | undefined;

                let _placeholder = await sendHybridInteractionMessageResponse(
                    data,
                    { embeds: [EMBEDS.SENDING_SERVICE_ANNOUNCEMENT(data)] },
                    true
                );
                if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

                await Promise.map(
                    toSend,
                    (element) => {
                        return new Promise(async (resolve, reject) => {
                            let Guild: Guild = element[0];
                            let Channel: TextChannel = element[1];
                            try {
                                const guildObject = DiscordProvider.client.guilds.cache.get(Guild.id);
                                if (!guildObject) throw new Error('Guild not found');
                                Logger.info(
                                    `Sending Service Announcement to ${guildObject?.name} (${guildObject.id}) #${Channel.name} (${Channel.id})`
                                );
                                await sendMessage(Channel, undefined, {
                                    embeds: [EMBEDS.MAKE_PAYLOAD(embed)]
                                });
                            } catch (err) {
                                withError = true;
                                const guildObject = DiscordProvider.client.guilds.cache.get(Guild.id);
                                if (guildObject)
                                    Logger.info(
                                        `Unable to send Service Announcement to ${guildObject?.name} (${guildObject.id}) #${Channel.name} (${Channel.id})`
                                    );

                                reject(err);
                            }

                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            resolve();
                        });
                    },
                    { concurrency: 2 }
                );

                if (withError) {
                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder.getMessage().edit({
                            embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT_WITH_ERRORS(data)]
                        });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            {
                                embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT_WITH_ERRORS(data)]
                            },
                            true
                        );
                } else {
                    if (data && data.isMessage() && placeholder && placeholder.isMessage())
                        return placeholder.getMessage().edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT(data)] });
                    else if (data.isApplicationCommand())
                        return await sendHybridInteractionMessageResponse(
                            data,
                            { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT(data)] },
                            true
                        );
                }
            }
        };

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.ANNOUNCEMENT_INFO(data)]
                });
            query = args[0].toLowerCase();
        } else if (data.isApplicationCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'info':
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.ANNOUNCEMENT_INFO(data)]
                });
            case 'reload':
                return await funct.reload(data);
            case 'previewnews':
                return await funct.previewNews(data);
            case 'previewmaintenance':
                return await funct.previewMaintenance(data);
            case 'previewmessage':
                return await funct.previewMessage(data);
            case 'previewalert':
                return await funct.previewAlert(data);
            case 'sendnews':
                return await funct.publishServiceAnnouncement(data, Announcements.News);
            case 'sendmaintenance':
                return await funct.publishServiceAnnouncement(data, Announcements.Maintenance);
            case 'sendmessage':
                return await funct.publishServiceAnnouncement(data, Announcements.Message);
            case 'sendalert':
                return await funct.publishServiceAnnouncement(data, Announcements.Alert);
        }
    }
}
