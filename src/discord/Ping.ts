import { CommandInteraction, Message } from 'discord.js';
import os from 'os';
import NodePing from 'ping';
import { Promise } from 'bluebird';
import { I18n } from 'i18n';

import Configuration from '../providers/Configuration';
import DiscordProvider from '../providers/Discord';
import Environment from '../providers/Environment';
import Locale from '../services/Locale';

import DiscordModule, { HybridInteractionMessage } from '../utils/DiscordModule';
import { makeSuccessEmbed, makeProcessingEmbed, sendHybridInteractionMessageResponse } from '../utils/DiscordMessage';
import Logger from '../libs/Logger';

const LOGGING_TAG = '[Ping]';

enum MeasureType {
    Ping = 'ping',
    DiscordHTTPPing = 'discordhttp',
    DiscordWebsocket = 'discordwebsocket'
}

const EMBEDS = {
    PING_INFO: (data: HybridInteractionMessage, locale: I18n, description: string) => {
        return makeSuccessEmbed({
            icon: '🌎',
            title: locale.__('ping.title'),
            description: description,
            user: data.getUser()
        });
    },
    PINGING: (data: HybridInteractionMessage, locale: I18n) => {
        return makeProcessingEmbed({
            icon: data.isMessage() ? undefined : '⌛',
            title: locale.__('ping.title_processing'),
            user: data.getUser()
        });
    }
};

export default class Ping extends DiscordModule {
    public id = 'Discord_Ping';
    public commands = ['ping'];
    public commandInteractionName = 'ping';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        const member = data.getMember();

        if (!guild || !member) return;

        const locale = await Locale.getGuildLocale(guild.id);

        let placeholder: HybridInteractionMessage | undefined;
        let beforeEditDate = Date.now();
        let _placeholder = await sendHybridInteractionMessageResponse(data, {
            embeds: [EMBEDS.PINGING(data, locale)]
        });
        if (_placeholder) placeholder = new HybridInteractionMessage(_placeholder);

        let afterEditDate = Date.now();

        let finalString = [];

        await Promise.map(
            Configuration.getConfig('Ping'),
            (entry: any) => {
                return new Promise(async (resolve, reject) => {
                    let stringCurrent = `${entry.title}`;

                    if (entry.type === MeasureType.Ping) {
                        Logger.debug(LOGGING_TAG, `Pinging ${entry.host}`);
                        const res = await NodePing.promise.probe(entry.host!, { min_reply: 4 });

                        if (!res.alive) {
                            Logger.debug(LOGGING_TAG, `Ping failed for ${entry.host} (not alive)`);
                            stringCurrent += 'Failed';
                            return finalString.push(stringCurrent);
                        }

                        if (res.avg === 'unknown' || res.min === 'unknown' || res.max === 'unknown') {
                            Logger.debug(LOGGING_TAG, `Ping failed for ${entry.host} (unknown)`);
                            stringCurrent += 'Failed';
                            return finalString.push(stringCurrent);
                        }

                        Logger.debug(
                            LOGGING_TAG,
                            `Ping result for ${entry.host}: Avg: ${res.avg}ms, Min: ${res.min}ms, Max: ${res.max}ms`
                        );

                        stringCurrent += `${parseFloat(res.avg).toFixed(1)}ms (${parseFloat(res.min).toFixed(
                            1
                        )}ms - ${parseFloat(res.max).toFixed(1)}ms)`;
                        finalString.push(stringCurrent);
                    } else if (entry.type === MeasureType.DiscordWebsocket) {
                        Logger.debug(LOGGING_TAG, `Pinging DiscordWebsocket`);
                        stringCurrent += `${Math.round(DiscordProvider.client.ws.ping).toFixed(1)}ms`;
                        finalString.push(stringCurrent);
                    } else if (entry.type === MeasureType.DiscordHTTPPing) {
                        Logger.debug(LOGGING_TAG, `Pinging DiscordHTTPPing`);
                        stringCurrent += `${Math.abs(afterEditDate - beforeEditDate).toFixed(1)}ms`;
                        finalString.push(stringCurrent);
                    }

                    resolve();
                });
            },
            { concurrency: 5 }
        );

        Logger.debug(LOGGING_TAG, `All pings done, sending message`);

        finalString.push('');
        finalString.push(
            `💻 ${locale.__('ping.running_on', { HOST: os.hostname() })} ` +
                `${
                    Environment.get().NODE_ENV === 'development'
                        ? ` / ${locale.__('ping.development_environment')}`
                        : ''
                }`
        );

        if (data.isApplicationCommand())
            return await data
                .getMessageComponentInteraction()
                .editReply({ embeds: [EMBEDS.PING_INFO(data, locale, finalString.join('\n'))] });
        else if (data && data.isMessage() && placeholder && placeholder.isMessage())
            return await placeholder
                .getMessage()
                .edit({ embeds: [EMBEDS.PING_INFO(data, locale, finalString.join('\n'))] });
    }
}
