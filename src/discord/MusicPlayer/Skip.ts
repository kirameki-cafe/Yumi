import { Message, CommandInteraction, Interaction } from "discord.js";
import { makeSuccessEmbed, makeErrorEmbed, sendMessageOrInteractionResponse } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    SKIPPED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Skipped`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    SKIPPED_LASTSONG: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Skipped, that was the last song`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_MUSIC_PLAYING: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `There are no music playing`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_IN_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You need to be in the voice channel first!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_IN_SAME_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You are not in the same voice channel!`,
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

        if (!data.member.voice.channel)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data)] });
        
        if (!channel) return;

        let voiceChannel = data.member.voice.channel;

        if(!DiscordMusicPlayer.isGuildInstanceExists(data.guildId))
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data)] });

        const instance = DiscordMusicPlayer.getGuildInstance(data.guildId);

        if(instance!.voiceChannel.id !== data.member.voice.channel.id)
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data)] }, true);

        if(instance?.queue.track.length === 0)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data)] });

        instance!.skipTrack();

        if(instance?.queue.track.length === 0)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SKIPPED_LASTSONG(data)] });
        else
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SKIPPED(data)] });
    }
}