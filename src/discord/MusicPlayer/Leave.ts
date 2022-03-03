import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction } from "discord.js";
import { makeSuccessEmbed, makeErrorEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    VOICECHANNEL_LEFT: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Success`,
            description: `Left the voice channel`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_IN_VOICECHANNEL: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `You need to be in the voice channel first!`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    NO_MUSIC_PLAYING: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `There are no music playing`,
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

export default class Leave extends DiscordModule {
    
    public id = "Discord_MusicPlayer_Leave";
    public commands = ["leave", "disconnect", "dc"];
    public commandInteractionName = "leave";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) { 
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();
        const member = data.getMember();

        if(!guild || !member) return;

        const voiceChannel = member.voice.channel;
        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data.getRaw())] });
              
        let instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if(!instance)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        if(instance.voiceChannel.id !== voiceChannel.id)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data.getRaw())] });
        

        DiscordMusicPlayer.destoryGuildInstance(guild.id);
        await sendHybridInteractionMessageResponse(data, { embeds:[EMBEDS.VOICECHANNEL_LEFT(data.getRaw())] });

        return;
    }
}