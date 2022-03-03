import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction, MessageActionRow, TextChannel, MessageButton } from "discord.js";
import { makeErrorEmbed, makeInfoEmbed, sendHybridInteractionMessageResponse } from "../../utils/DiscordMessage";
import DiscordProvider from "../../providers/Discord";
import DiscordMusicPlayer, { ValidTracks } from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    NOW_PLAYING: (data: Message | Interaction, track: ValidTracks) => {
        const embed = makeInfoEmbed({
            title: ' Now playing',
            icon: '🎵',
            description: `${track.title}`,
            user: DiscordProvider.client.user
        });

        const highestResolutionThumbnail = track.thumbnails.reduce((prev, current) => (prev.height * prev.width > current.height * current.width) ? prev : current)

        if(highestResolutionThumbnail)
            embed.setImage(highestResolutionThumbnail.url);
        
        return embed;
    },
    NO_MUSIC_PLAYING: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `There are no music playing`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class NowPlaying extends DiscordModule {

    public id = "Discord_MusicPlayer_NowPlaying";
    public commands = ["nowplaying", "np"];
    public commandInteractionName = "nowplaying";
    
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
        if(!instance || !instance.queue.track[0]) return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setEmoji('▶️')
                    .setLabel(' Open on YouTube')
                    .setURL(encodeURI(`https://www.youtube.com/watch?v=${instance.queue.track[0].id}`))
                    .setStyle('LINK'),
            )

        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NOW_PLAYING(data.getRaw(), instance.queue.track[0])], components: [row] });
    }
}