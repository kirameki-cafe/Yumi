import { CommandInteraction, Interaction, Message } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse, sendReply, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import Cache from "../providers/Cache";

const EMBEDS = {
    INFO: async (data: Message | Interaction) => {

        let GuildCache = await Cache.getGuild(data.guildId!);
        //if(typeof GuildCache === 'undefined' || typeof GuildCache.prefix === 'undefined') return;

        let prefix = GuildCache.prefix || '>';

        let _e = makeInfoEmbed({
            icon: "💌",
            title: `Help - ${DiscordProvider.client.user?.username}`,
            fields: [
                {
                    name: 'Info',
                    value: `Yumi is currently undergoing complete rewrite, as expected, losing many of her functionality. All of the features will be re-implemented.`
                },
                {
                    name: 'Why?',
                    value: `Yumi was specifically written for use in a only 1 private server, now it's time to extend the border and globalize it (just kidding lol)`
                },
                {
                    name: 'Prefix',
                    value: `You can call me using \`\`${prefix.replaceAll('`','`​')}\`\`, <@${DiscordProvider.client.user?.id}> or \`\`/slash command\`\``
                },
                {
                    name: 'Available commands',
                    value: '``help``\n``ping``\n``invite``\n``membershipscreening (ms)``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
        _e.setThumbnail(DiscordProvider.client.user?.avatarURL() || '');
        return _e;
    }
}

export default class Help {

    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'help') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'help') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {

        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        let sent = await sendMessageOrInteractionResponse(data, { embeds: [await EMBEDS.INFO(data)] });

        if(isMessage)
            return (sent as Message).react("♥");
        
    }
}