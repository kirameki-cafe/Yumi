import { Message, CommandInteraction, Interaction, MessageActionRow, TextChannel, MessageButton } from "discord.js";
import { makeErrorEmbed, sendMessageOrInteractionResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
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

        embed.setImage(track.thumbnails[0].url);
        return embed;
    },
    NO_MUSIC_PLAYING: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `There are no music playing`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class NowPlaying {
    
    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'nowplaying' && command.toLowerCase() !== 'np') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'nowplaying') return;
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
        if(!instance || !instance.queue.track[0]) return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data)] });

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setEmoji('▶️')
                    .setLabel(' Open on YouTube')
                    .setURL(encodeURI(`https://www.youtube.com/watch?v=${instance.queue.track[0].id}`))
                    .setStyle('LINK'),
            )

        return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.NOW_PLAYING(data, instance.queue.track[0])], components: [row] });
    }
}