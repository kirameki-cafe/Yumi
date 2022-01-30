import { Message, CommandInteraction, Interaction, VoiceChannel } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Users from "../../services/Users"
import Environment from "../../providers/Environment";
import DiscordMusicPlayer, { DiscordMusicPlayerInstance } from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    VOICECHANNEL_LEFT: (data: Message | Interaction) => {
        return makeSuccessEmbed({
            title: `Success`,
            description: `Left the voice channel`,
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
        if(!channel) return;
        
        
        let instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        if(!instance) return;
        

        DiscordMusicPlayer.destoryGuildInstance(data.guild?.id!);
        await sendMessageOrInteractionResponse(data, { embeds:[EMBEDS.VOICECHANNEL_LEFT(data)] });

        return;
    }
}