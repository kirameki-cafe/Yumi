import { Message, Interaction, CommandInteraction } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, sendMessageOrInteractionResponse } from "../../utils/DiscordMessage";
import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";
import Users from "../../services/Users";

const EMBEDS = {
    FAKEERROR_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: 'Fake error',
            description: `Simulate an error`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``crashMusicPlayer``'
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
}

export default class FakeError {

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'fakeerror') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'fakeerror') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        if (!Users.isDeveloper(data.member?.user.id!))
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NOT_DEVELOPER(data)] });

        if(!data.guildId) return;

        const funct = {
            crashMusicPlayer: async (data: Message | Interaction) => {
                const instance = DiscordMusicPlayer.getGuildInstance(data.guildId!);
                if(!instance) return;

                instance._fake_error_on_player();
            }
        }

        let query;

        if (isMessage) {
            if (data === null || !data.guildId || data.member === null || data.guild === null) return;

            if (args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.FAKEERROR_INFO(data)] });
            }
            query = args[0].toLowerCase();

        }
        else if (isSlashCommand) {
            query = args.getSubcommand();
        }

        switch (query) {
            case "info":
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.FAKEERROR_INFO(data)] });
            case "crashmusicplayer":
                return await funct.crashMusicPlayer(data);
        }

    }
}