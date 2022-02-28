import { Message, CommandInteraction, Interaction } from "discord.js";
import { makeSuccessEmbed, makeErrorEmbed, sendMessageOrInteractionResponse } from "../../utils/DiscordMessage";
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

export default class Leave {
    
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'leave') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'leave') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        if(!data.member) return;
        if(!data.guildId) return;

        const channel: any = isMessage ? data.member.voice.channel : DiscordProvider.client.guilds.cache.get((data as Interaction).guildId!)!.members.cache.get((data as Interaction).user.id)?.voice.channel; 
        if (!data.member.voice.channel)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data)] });
            
        if(!channel) return;
        
        
        let instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        if(!instance)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data)] });

        if(instance.voiceChannel.id !== data.member.voice.channel.id)
            return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data)] });
        

        DiscordMusicPlayer.destoryGuildInstance(data.guild?.id!);
        await sendMessageOrInteractionResponse(data, { embeds:[EMBEDS.VOICECHANNEL_LEFT(data)] });

        return;
    }
}