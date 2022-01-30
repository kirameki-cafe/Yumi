import { Message, CommandInteraction, Interaction, VoiceChannel } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Users from "../../services/Users"
import Environment from "../../providers/Environment";
import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    SKIPPED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Skipped`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class Skip {

    async onCommand(command: string, args: any, message: Message) {
        if (command.toLowerCase() !== 'skip') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) {
        if (interaction.isCommand()) {
            if (typeof interaction.commandName === 'undefined') return;
            if ((interaction.commandName).toLowerCase() !== 'skip') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if (!isSlashCommand && !isMessage) return;

        if (!data.member) return;
        if (!data.guildId) return;

        const channel: any = isMessage ? data.member.voice.channel : DiscordProvider.client.guilds.cache.get((data as Interaction).guildId!)!.members.cache.get((data as Interaction).user.id)?.voice.channel;
        if (!channel) return;


        // TODO: User must be in vc error msg
        if (!data.member.voice.channel) return;
        let voiceChannel = data.member.voice.channel;

        // TODO: No queue error
        if(!DiscordMusicPlayer.isGuildInstanceExists(data.guildId)) {
            return;
        }

        const instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        instance!.skipTrack();

        //await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SKIPPED(data)] });

        return;
    }
}