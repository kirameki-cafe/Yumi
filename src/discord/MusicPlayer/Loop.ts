import DiscordModule, { HybridInteractionMessage } from "../../utils/DiscordModule";

import { Message, CommandInteraction, Interaction, MessageActionRow, ButtonInteraction, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import { makeErrorEmbed, makeSuccessEmbed, sendHybridInteractionMessageResponse, makeInfoEmbed } from "../../utils/DiscordMessage";
import DiscordMusicPlayer, { DiscordMusicPlayerLoopMode } from "../../providers/DiscordMusicPlayer";

const EMBEDS = {
    INVALID_LOOP_MODE: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `Invalid loop mode`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    LOOP_STATUS: (data: Message | Interaction, loopMode: DiscordMusicPlayerLoopMode) => {
        let embed = makeInfoEmbed({
            title: `Current loop mode is ${loopMode}`,
            description: "Available loop mode: ``None`` ``Current``",
            user: (data instanceof Interaction) ? data.user : data.author
        });
        return embed;
    },
    LOOP_SET: (data: Message | Interaction, loopMode: DiscordMusicPlayerLoopMode) => {
        let embed = makeSuccessEmbed({
            title: `Loop mode is now set to ${loopMode}`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
        return embed;
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
    },
    NO_MUSIC_PLAYING: (data: Message | Interaction) => {
        return makeErrorEmbed({
            title: `There are no music playing`,
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}
export default class Loop extends DiscordModule {

    public id = "Discord_MusicPlayer_Loop";
    public commands = ["loop"];
    public commandInteractionName = "loop";

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {

        const guild = data.getGuild();
        const user = data.getUser();
        const member = data.getMember();
        const channel = data.getChannel();

        if (!guild || !user || !member || !channel) return;

        let query;

        if (data.isMessage()) {
            if (args.length !== 0)
                query = args.join(' ');
        }
        else if (data.isSlashCommand())
            query = args.getSubcommand();

        const voiceChannel = member.voice.channel;

        if (!voiceChannel)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_VOICECHANNEL(data.getRaw())] });

        const instance = DiscordMusicPlayer.getGuildInstance(guild.id);

        if (!instance)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        if (instance.voiceChannel.id !== voiceChannel.id)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.USER_NOT_IN_SAME_VOICECHANNEL(data.getRaw())] }, true);

        if (instance.queue.track.length === 0)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.NO_MUSIC_PLAYING(data.getRaw())] });

        if (!query)
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.LOOP_STATUS(data.getRaw(), instance.getLoopMode())] });

        let enumKey = Object.keys(DiscordMusicPlayerLoopMode)[Object.values(DiscordMusicPlayerLoopMode).indexOf(query.toLowerCase())];

        if(enumKey) {
            instance.setLoopMode(DiscordMusicPlayerLoopMode[enumKey as keyof typeof DiscordMusicPlayerLoopMode]);
            return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.LOOP_SET(data.getRaw(), instance.getLoopMode())] });
        }
        
        return await sendHybridInteractionMessageResponse(data, { embeds: [EMBEDS.INVALID_LOOP_MODE(data.getRaw())] });
    }

}