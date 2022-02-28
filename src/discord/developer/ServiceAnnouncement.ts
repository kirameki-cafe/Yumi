import { Message, MessageEmbed, Interaction, CommandInteraction, TextChannel } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, makeSuccessEmbed, makeProcessingEmbed, makeWarningEmbed, sendMessageOrInteractionResponse, sendMessage } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Prisma from "../../providers/Prisma";
import Users from "../../services/Users";

import { Promise } from "bluebird";
import fs from "fs";
import path from "path";
import Logger from "../../libs/Logger";
import { Guild } from "@prisma/client";

const EMBEDS = {
    ANNOUNCEMENT_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Service Announcement',
            description: `This module contains management tool for announcement feed\n The announcement message is located in \`\`configs/ServiceAnnouncement.json\`\``,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``reload`` ``previewNews`` ``sendNews`` ``previewMaintenance`` ``sendMaintenance`` ``previewMessage`` ``sendMessage`` ``previewAlert`` ``sendAlert``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NOT_DEVELOPER: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: 'Developer only',
            description: `This command is restricted to the developers only`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    MAKE_PAYLOAD: (data: Message | Interaction, payload: any) => {
        const user = DiscordProvider.client.user;
        payload.footer = {
            text: `${user?.username}`,
            iconURL: user?.avatarURL() || ''
        }

        if (!payload.timestamp)
            payload.timestamp = new Date();

        if (payload.thumbnail?.url === 'bot_avatar')
            payload.thumbnail.url = user?.avatarURL() || '';

        if (payload.image?.url === 'bot_avatar')
            payload.image.url = user?.avatarURL() || '';

        if (payload.description)
            payload.description = payload.description.replaceAll('{bot_username}', user?.username)

        return new MessageEmbed(payload)
    },
    RELOADED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: 'Service Announcement Configuration Reloaded',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    RELOAD_ERROR: (data: Message | Interaction, error: string) => {
        return makeErrorEmbed({
            title: 'Unable to reload Service Announcement Configuration',
            description: `\`\`\`${error}\`\`\``,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SENDING_SERVICE_ANNOUNCEMENT: (data: Message | Interaction) => {
        return makeProcessingEmbed({
            title: 'Service Announcement',
            description: `Broadcasting Service Announcement`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SERVICE_ANNOUNCEMENT_SENT: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: 'Service Announcement',
            description: `Broadcasted Service Announcement`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SERVICE_ANNOUNCEMENT_SENT_WITH_ERRORS: (data: Message | Interaction) => {
        return makeWarningEmbed({
            title: 'Service Announcement',
            description: `Broadcasted Service Announcement with errors, check console for more info`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
}

let Announcements = {
    News: {
        color: "#FAEDF0",
        title: '📰 Newsletter',
        description: 'Some description here',
        thumbnail: {
            url: 'bot_avatar',
        }
    },
    Maintenance: {
        color: "#383b80",
        title: '🔧 Maintenance',
        description: 'The bot is going offline for maintenance.',
        thumbnail: {
            url: 'bot_avatar',
        }
    },
    Message: {
        color: "#A1DE93",
        title: '✉️ Message',
        description: 'Some description here',
        thumbnail: {
            url: 'bot_avatar',
        }
    },
    Alert: {
        color: "#EC255A",
        title: '🚨 Alert',
        description: 'Some description here',
        thumbnail: {
            url: 'bot_avatar',
        }
    }

}
export default class InteractionManager {

    async init() {

        if (fs.existsSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'))) {
            try {
                const rawData = fs.readFileSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'));
                const jsonData = JSON.parse(rawData.toString());
                Announcements = jsonData;
            } catch (err) {
                Logger.error("Unable to load custom ServiceAnnouncement config: " + err);
            }
        }
    }

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'serviceannouncement') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'serviceannouncement') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        if (!Users.isDeveloper(data.member?.user.id!))
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NOT_DEVELOPER(data)] });

        const funct = {
            reload: async (data: Message | Interaction) => {

                if (fs.existsSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'))) {
                    try {
                        const rawData = fs.readFileSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'));
                        const jsonData = JSON.parse(rawData.toString());
                        Announcements = jsonData;
                    } catch (err: any) {
                        Logger.error("Unable to load custom ServiceAnnouncement config: " + err);
                        return await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.RELOAD_ERROR(data, err)] });
                    }
                } else {
                    fs.writeFileSync(path.join(process.cwd(), 'configs/ServiceAnnouncement.json'), JSON.stringify(Announcements, null, 4), 'utf8');
                }

                return await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.RELOADED(data)] });
            },
            previewNews: async (data: Message | Interaction) => {
                return await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.MAKE_PAYLOAD(data, Announcements.News)] });
            },
            previewMaintenance: async (data: Message | Interaction) => {
                return await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.MAKE_PAYLOAD(data, Announcements.Maintenance)] });
            },
            previewMessage: async (data: Message | Interaction) => {
                return await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.MAKE_PAYLOAD(data, Announcements.Message)] });
            },
            previewAlert: async (data: Message | Interaction) => {
                return await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.MAKE_PAYLOAD(data, Announcements.Alert)] });
            },
            publishServiceAnnouncement: async (data: Message | Interaction, embed: any) => {
                const Guilds = await Prisma.client.guild.findMany({});
                const toSend = new Map();

                let withError = false;

                for (const Guild of Guilds) {
                    if (!Guild.ServiceAnnouncement_Enabled) continue;
                    if (Guild.ServiceAnnouncement_Channel === null) continue;

                    let channel = undefined;
                    try {
                        channel = await DiscordProvider.client.channels.fetch(Guild.ServiceAnnouncement_Channel) as TextChannel;
                    } catch (err) {
                        // TODO: Handle channel not found error
                        withError = true;
                        const guildObject = DiscordProvider.client.guilds.cache.get(Guild.id);
                        Logger.warn(`Unable to find channel for Service Announcement to ${guildObject?.name} (${Guild.id}) (Channel ID: ${Guild.ServiceAnnouncement_Channel})`);
                        continue;
                    }

                    if (!channel) continue;
                    toSend.set(Guild, channel);
                }

                let placeholder = await sendMessage(data.channel!, undefined, { embeds: [EMBEDS.SENDING_SERVICE_ANNOUNCEMENT(data)] });

                await Promise.map(toSend, element => {
                    return new Promise(async (resolve, reject) => {
                        let Guild: Guild = element[0];
                        let Channel: TextChannel = element[1];
                        try {
                            const guildObject = DiscordProvider.client.guilds.cache.get(Guild.id);
                            if (!guildObject)
                                throw new Error('Guild not found');
                            Logger.info(`Sending Service Announcement to ${guildObject?.name} (${guildObject.id}) #${Channel.name} (${Channel.id})`);
                            await sendMessage(Channel, undefined, { embeds: [EMBEDS.MAKE_PAYLOAD(data, embed)] })
                        } catch (err) {
                            withError = true;
                            const guildObject = DiscordProvider.client.guilds.cache.get(Guild.id);
                            if (guildObject)
                                Logger.info(`Unable to send Service Announcement to ${guildObject?.name} (${guildObject.id}) #${Channel.name} (${Channel.id})`);

                            reject(err);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1000));
                        resolve();
                    });
                }, { concurrency: 2 });

                if (withError) {
                    if (isMessage)
                        (placeholder as Message).edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT_WITH_ERRORS(data)] });
                    else if (isSlashCommand)
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT_WITH_ERRORS(data)] }, true);
                }
                else {
                    if (isMessage)
                        (placeholder as Message).edit({ embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT(data)] });
                    else if (isSlashCommand)
                        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SERVICE_ANNOUNCEMENT_SENT(data)] }, true);
                }
            }
        }

        let query;

        if (isMessage) {
            if (data === null || !data.guildId || data.member === null || data.guild === null) return;

            if (args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ANNOUNCEMENT_INFO(data)] });
            }
            query = args[0].toLowerCase();

        }
        else if (isSlashCommand) {
            query = args.getSubcommand();
        }

        switch (query) {
            case "info":
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.ANNOUNCEMENT_INFO(data)] });
            case "reload":
                return await funct.reload(data);
            case "previewnews":
                return await funct.previewNews(data);
            case "previewmaintenance":
                return await funct.previewMaintenance(data);
            case "previewmessage":
                return await funct.previewMessage(data);
            case "previewalert":
                return await funct.previewAlert(data);
            case "sendnews":
                return await funct.publishServiceAnnouncement(data, Announcements.News);
            case "sendmaintenance":
                return await funct.publishServiceAnnouncement(data, Announcements.Maintenance);
            case "sendmessage":
                return await funct.publishServiceAnnouncement(data, Announcements.Message);
            case "sendalert":
                return await funct.publishServiceAnnouncement(data, Announcements.Alert);
        }

    }
}