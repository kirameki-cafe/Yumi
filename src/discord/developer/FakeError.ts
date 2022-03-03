import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, Interaction, CommandInteraction } from "discord.js";
import { makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
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

export default class FakeError extends DiscordModule {

    public id = "Discord_Developer_FakeError";
    public commands = ["fakeerror"];
    public commandInteractionName = "fakeerror";
    
    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        
        const guild = data.getGuild();
        const user = data.getUser();
        
        if(!guild || !user) return;

        if (!Users.isDeveloper(user.id!))
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NOT_DEVELOPER(data.getRaw())] });

        const funct = {
            crashMusicPlayer: async (data: HybridInteractionMessage) => {
                const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
                if(!instance) return;

                instance._fake_error_on_player();
            }
        }

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.FAKEERROR_INFO(data.getRaw())] });
            
            query = args[0].toLowerCase();
        }
        else if (data.isSlashCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case "info":
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.FAKEERROR_INFO(data.getRaw())] });
            case "crashmusicplayer":
                return await funct.crashMusicPlayer(data);
        }

    }
}