import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction, TextChannel } from "discord.js";
import { makeErrorEmbed, sendHybridInteractionMessageResponse, makeInfoEmbed } from "../../utils/DiscordMessage";

import DiscordMusicPlayer, { Queue } from "../../providers/DiscordMusicPlayer";

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

export default class QueueCommand extends DiscordModule {

    public id = "Discord_MusicPlayer_Queue";
    public commands = ["queue", "q"];
    public commandInteractionName = "queue";
    
    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();

        if(!guild) return;

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);
        if(!instance) return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        await sendHybridInteractionMessageResponse(data, { embeds:[EMBEDS.QUEUE(data.getRaw(), instance.queue)] });

        return;
    }
}