import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction } from "discord.js";
import { makeSuccessEmbed, makeInfoEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    PAUSED: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Paused`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    ALREADY_PAUSED: (data: Message | Interaction) => {
        return makeInfoEmbed({
            title: `Already paused`,
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

export default class Pause extends DiscordModule{

    public id = "Discord_MusicPlayer_Pause";
    public commands = ["pause"];
    public commandInteractionName = "pause";

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

        const voiceChannel = member.voice.channel;

        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data.getRaw())] });

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);

        if(!instance)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        if(instance.voiceChannel.id !== voiceChannel.id)
                return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data.getRaw())] }, true);

        if(instance.queue.track.length === 0)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        if(instance.isPaused())
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.ALREADY_PAUSED(data.getRaw())] });
        
        instance.pausePlayer();
        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.PAUSED(data.getRaw())] });
    }
}