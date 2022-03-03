import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction } from "discord.js";
import { makeSuccessEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
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

export default class Skip extends DiscordModule{

    public id = "Discord_MusicPlayer_Skip";
    public commands = ["skip"];
    public commandInteractionName = "skip";

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

        instance.skipTrack();

        if(instance.queue.track.length === 0)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SKIPPED_LASTSONG(data.getRaw())] });
        else
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.SKIPPED(data.getRaw())] });
    }
}