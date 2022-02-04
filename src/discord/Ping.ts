import { CommandInteraction, Message, Interaction } from "discord.js";
import { makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import NodePing from "ping";
import fs from "fs";
import path from "path";
import os from "os";
import Logger from "../libs/Logger";
import Environment from "../providers/Environment";

enum MeasureType {
    Ping = "ping",
    DiscordHTTPPing = "discordhttp",
    DiscordWebsocket = "discordwebsocket"
}

let measureList: any = [];

const EMBEDS = {
    PING_INFO: (data: Message | Interaction, description: string) => {
        return makeSuccessEmbed({
            icon: '🌎',
            title: `Network performance`,
            description: description,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class Ping {

    async init() {

        if (fs.existsSync(path.join(process.cwd(), 'configs/Ping.json'))) {
            try {
                const rawData = fs.readFileSync(path.join(process.cwd(), 'configs/Ping.json'));
                const jsonData = JSON.parse(rawData.toString());
                measureList = jsonData;
            } catch (err) {
                Logger.error("Unable to load custom Ping config: " + err);
            }
        }

    }

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'ping') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'ping') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        let placeholder;

        const loadingEmbed = makeProcessingEmbed({
            icon: isMessage ? undefined : '⌛',
            title: `Measuring network performance`,
            user: (data instanceof Interaction) ? data.user : data.author
        });

        let beforeEditDate = Date.now();
        placeholder = await sendMessageOrInteractionResponse(data, { embeds: [loadingEmbed] });
        let afterEditDate = Date.now();


        let desString = [];

        // TODO: Optimize speed of this

        for (let entry of measureList) {

            let stringCurrent = `${entry.title}`;

            if (entry.type === MeasureType.Ping) {
                const res = await NodePing.promise.probe(entry.host!, { min_reply: 4 });

                if (!res.alive) {
                    stringCurrent += "Failed";
                    return desString.push(stringCurrent);
                }

                if (res.avg === 'unknown' || res.min === 'unknown' || res.max === 'unknown') {
                    stringCurrent += "Failed";
                    return desString.push(stringCurrent);
                }

                stringCurrent += `${parseFloat(res.avg).toFixed(1)}ms (${parseFloat(res.min).toFixed(1)}ms - ${parseFloat(res.max).toFixed(1)}ms)`;
                desString.push(stringCurrent);
            } else if (entry.type === MeasureType.DiscordWebsocket) {
                stringCurrent += `${Math.round(DiscordProvider.client.ws.ping).toFixed(1)}ms`;
                desString.push(stringCurrent);
            } else if (entry.type === MeasureType.DiscordHTTPPing) {
                stringCurrent += `${Math.abs(afterEditDate - beforeEditDate).toFixed(1)}ms`;
                desString.push(stringCurrent);
            }

        }

        desString.push("");
        desString.push("💻 Running on " + `${os.hostname()}${Environment.get().NODE_ENV === "development" ? ' / Development Environment' : ''}`);

        if (isSlashCommand) return await data.editReply({ embeds: [EMBEDS.PING_INFO(data, desString.join('\n'))] });
        else if (typeof placeholder !== "undefined" && isMessage && placeholder instanceof Message) return await placeholder.edit({ embeds: [EMBEDS.PING_INFO(data, desString.join('\n'))] });
    }

}