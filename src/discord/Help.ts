import DiscordModule, { HybridInteractionMessage } from "../utils/DiscordModule";

import { CommandInteraction, Interaction, Message } from "discord.js";
import { sendHybridInteractionMessageResponse, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import Cache from "../providers/Cache";

const EMBEDS = {
    INFO: async (data: Message | Interaction) => {

        let GuildCache = await Cache.getGuild(data.guildId!);

        // TODO: Better error handling
        if(typeof GuildCache === 'undefined')
            throw new Error("Guild not found");

        let prefix = GuildCache.prefix || '>';

        let _e = makeInfoEmbed({
            icon: "💌",
            title: `Help - ${DiscordProvider.client.user?.username}`,
            description: `\u200b\n📰 **Info**\nYumi is currently undergoing complete rewrite, as expected, losing many of her functionality. All of the features will be re-implemented.\n\n🤔 **Why?**\nYumi was specifically written for use in a only 1 private server, now it's time to extend the border and globalize it (just kidding lol)\n\n🏷️ **Prefix**\nYou can call me using \`\`${prefix.replaceAll('`','`​')}\`\`, <@${DiscordProvider.client.user?.id}> or \`\`/slash command\`\`\n\n💻 **Available commands**`,
            fields: [
                {
                    name: '☕ General',
                    value: `help, ping, invite, userinfo, stats`,
                    inline: true
                },
                {
                    name: '🎵 Music',
                    value: `play (p), search, skip, queue, nowplaying (np), join, leave`,
                    inline: true
                },
                {
                    name: '🎮 Games',
                    value: `osu`,
                    inline: true
                },
                {
                    name: '🔐 Admin',
                    value: `settings, say, membershipscreening (ms)`,
                    inline: true
                },
                {
                    name: '🔧 Developer',
                    value: 'interactions, serviceannouncement',
                    inline: true
                },
                {
                    name: '\u200b',
                    value: '**Made with 💖 and [open source](https://github.com/YuzuZensai/Yumi)**',
                    inline: false
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
        _e.setThumbnail(`${DiscordProvider.client.user?.avatarURL()}?size=4096` || '');
        return _e;
    }
}

export default class Help extends DiscordModule {

    public id = "Discord_Help";
    public commands = ["help"];
    public commandInteractionName = "help";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) { 
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const message = await sendHybridInteractionMessageResponse(data, { embeds: [await EMBEDS.INFO(data.getRaw())] });

        if(message && data.isMessage())
            return new HybridInteractionMessage(message).getMessage().react("♥");
    }
}