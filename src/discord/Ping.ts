import DiscordModule, { HybridInteractionMessage } from "../utils/DiscordModule";

import { CommandInteraction, Message, Interaction } from "discord.js";
import { makeSuccessEmbed, makeProcessingEmbed, sendHybridInteractionMessageResponse } from "../utils/DiscordMessage";

import DiscordProvider from "../providers/Discord";
import NodePing from "ping";
import { Promise } from "bluebird";
import os from "os";
import Environment from "../providers/Environment";
import Configuration from "../providers/Configuration";

enum MeasureType {
    Ping = "ping",
    DiscordHTTPPing = "discordhttp",
    DiscordWebsocket = "discordwebsocket"
}

const EMBEDS = {
    PING_INFO: (data: Message | Interaction, description: string) => {
        return makeSuccessEmbed({
            icon: '🌎',
            title: `Network performance`,
            description: description,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    PINGING: (data: HybridInteractionMessage) => {
        return makeProcessingEmbed({
            icon: data.isMessage() ? undefined : '⌛',
            title: `Measuring network performance`,
            user: (data.isInteraction()) ? data.getInteraction().user : data.getMessage().author
        });
    }
}

export default class Ping extends DiscordModule {

    public id = "Discord_Ping";
    public commands = ["ping"];
    public commandInteractionName = "ping";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        let placeholder: (HybridInteractionMessage | undefined);

        let beforeEditDate = Date.now();

        let _placeholder = await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PINGING(data)] });
        if (_placeholder)
            placeholder = new HybridInteractionMessage(_placeholder);

        let afterEditDate = Date.now();


        let finalString = [];

        await Promise.map(Configuration.getConfig("Ping"), (entry: any) => {
            return new Promise(async (resolve, reject) => {
                let stringCurrent = `${entry.title}`;

                if (entry.type === MeasureType.Ping) {
                    const res = await NodePing.promise.probe(entry.host!, { min_reply: 4 });

                    if (!res.alive) {
                        stringCurrent += "Failed";
                        return finalString.push(stringCurrent);
                    }

                    if (res.avg === 'unknown' || res.min === 'unknown' || res.max === 'unknown') {
                        stringCurrent += "Failed";
                        return finalString.push(stringCurrent);
                    }

                    stringCurrent += `${parseFloat(res.avg).toFixed(1)}ms (${parseFloat(res.min).toFixed(1)}ms - ${parseFloat(res.max).toFixed(1)}ms)`;
                    finalString.push(stringCurrent);
                } else if (entry.type === MeasureType.DiscordWebsocket) {
                    stringCurrent += `${Math.round(DiscordProvider.client.ws.ping).toFixed(1)}ms`;
                    finalString.push(stringCurrent);
                } else if (entry.type === MeasureType.DiscordHTTPPing) {
                    stringCurrent += `${Math.abs(afterEditDate - beforeEditDate).toFixed(1)}ms`;
                    finalString.push(stringCurrent);
                }

                resolve();
            });
        }, { concurrency: 5 });

        finalString.push("");
        finalString.push("💻 Running on " + `${os.hostname()}${Environment.get().NODE_ENV === "development" ? ' / Development Environment' : ''}`);

        if (data.isSlashCommand())
            return await data.getMessageComponentInteraction().editReply({ embeds: [EMBEDS.PING_INFO(data.getRaw(), finalString.join('\n'))] });
        else if (data && data.isMessage() && placeholder && placeholder.isMessage())
            return await placeholder.getMessage().edit({ embeds: [EMBEDS.PING_INFO(data.getRaw(), finalString.join('\n'))] });
    }

}