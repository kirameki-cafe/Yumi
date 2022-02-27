import { Message, CommandInteraction, Interaction, VoiceChannel, TextChannel } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeErrorEmbed, sendMessage, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import Users from "../../services/Users"
import Environment from "../../providers/Environment";
import DiscordMusicPlayer, { DiscordMusicPlayerInstance, ValidTracks, Queue } from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    QUEUE: (data: Message | Interaction, queue: Queue) => {
        if(!queue.track[0])
            return makeInfoEmbed({
                title: `Queue`,
                description: `The queue is empty!`,
                user: (data instanceof Interaction) ? data.user : data.author
            });
        else {
            if(queue.track.length == 1) {
                let queueString = `1. [${queue.track[0].title}](${queue.track[0].url})`
                return makeInfoEmbed({
                    title: `Queue`,
                    description: `Now playing: [${queue.track[0].title}](${queue.track[0].url})\n\nThere are ${queue.track.length} song in the queue!\n${queueString}`,
                    user: (data instanceof Interaction) ? data.user : data.author
                });
            }
            else if(queue.track.length >= 10) {
                let first10 = queue.track.slice(0, 10);
                let queueString = first10.map((track, index) => `${index + 1}. [${track.title}](${track.url})`).join("\n");
                return makeInfoEmbed({
                    title: `Queue`,
                    description: `Now playing: [${queue.track[0].title}](${queue.track[0].url})\nUpcoming song: [${queue.track[1].title}](${queue.track[1].url})\n\nThere are ${queue.track.length} songs in the queue!\n${queueString}\n${queue.track.length > 10 ? `...${queue.track.length - 10} more songs` : ""}`,
                    user: (data instanceof Interaction) ? data.user : data.author
                });
            } else {
                let queueString = queue.track.map((track, index) => `${index + 1}. [${track.title}](${track.url})`).join("\n");
                return makeInfoEmbed({
                    title: `Queue`,
                    description: `Now playing: [${queue.track[0].title}](${queue.track[0].url})\nUpcoming song: [${queue.track[1].title}](${queue.track[1].url})\n\nThere are ${queue.track.length} songs in the queue!\n${queueString}`,
                    user: (data instanceof Interaction) ? data.user : data.author
                });
            }
        }
    },
    NO_MUSIC_PLAYING: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `There are no music playing`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class QueueCommand {
    
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'queue') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'queue') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;

        if(!data.member) return;
        if(!data.guildId) return;
        if(!(data.channel instanceof TextChannel)) return;

        //const channel: any = isMessage ? data.member.voice.channel : DiscordProvider.client.guilds.cache.get((data as Interaction).guildId!)!.members.cache.get((data as Interaction).user.id)?.voice.channel; 
        //if(!channel) return;
        
        const instance = DiscordMusicPlayer.getGuildInstance(data.guildId);
        if(!instance) return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data)] });

        await sendMessageOrInteractionResponse(data, { embeds:[EMBEDS.QUEUE(data, instance.queue)] });

        return;
    }
}