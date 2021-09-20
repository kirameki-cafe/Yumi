import { Message, Permissions, Interaction, CommandInteraction } from "discord.js";
import { getEmotes, makeSuccessEmbed, makeProcessingEmbed, sendMessageOrInteractionResponse, sendReply, makeErrorEmbed, makeInfoEmbed } from "../utils/DiscordMessage";
import DiscordProvider from "../providers/Discord";
import { getColorFromURL } from "color-thief-node";

const EMBEDS = {
    SAY_INFO: (data: Message | Interaction) => {
        return makeInfoEmbed ({
            title: 'User Info',
            description: `View info on discord user`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``Discord user mention or id``'
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });
    },
    USER_NOT_FOUND: (data: Message | Interaction) => {
        return makeErrorEmbed ({
            title: 'That user cannot be found!',
            user: (data instanceof Interaction) ? data.user : data.author
        });
    }
}

export default class UserInfo {

    async onCommand(command: string, args: any, message: Message) {
        if(command.toLowerCase() !== 'userinfo') return;
        await this.process(message, args);
    }

    async interactionCreate(interaction: CommandInteraction) { 
        if(interaction.isCommand()) {
            if(typeof interaction.commandName === 'undefined') return;
            if((interaction.commandName).toLowerCase() !== 'userinfo') return;
            await this.process(interaction, interaction.options);
        }
    }

    async process(data: Interaction | Message, args: any) {
        const isSlashCommand = data instanceof CommandInteraction && data.isCommand();
        const isMessage = data instanceof Message;

        if(!isSlashCommand && !isMessage) return;
        
        let query;

        if(isMessage) {
            if(data === null || !data.guildId || data.member === null || data.guild === null) return;
            
            if(args.length === 0) {
                return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.SAY_INFO(data)] });
            }

            if(typeof data.mentions.users.first() !== 'undefined') {
                query = data.mentions.users.first()?.id;
            }
            else {
                query = args[0];
            }

        }
        else if(isSlashCommand) {
            query = data.options.getUser('user')?.id;
        }

        let TargetMember = (await data.guild!.members.fetch()).get(query);
            if(typeof TargetMember === 'undefined') return await sendMessageOrInteractionResponse(data, { embeds: [EMBEDS.USER_NOT_FOUND(data)] });

        if(isSlashCommand) {
            await data.deferReply();
        }
        else if(isMessage) {
        }

        let readableStatus: string = "Unknown";
        switch(TargetMember.presence?.status) {
            case "online":
                readableStatus = "🟢  Online";
                break;
            case "idle":
                readableStatus = "🌙  Idle";
                break;
            case "dnd":
                readableStatus = "⛔  Do not disturb";
                break;
            case "offline":
                readableStatus = "⚫  Offline";
                break;
        }

        const embed = makeInfoEmbed ({
            icon: '',
            title: `${TargetMember.user.tag}`,
            fields: [
                {
                    name: `${readableStatus}`,
                    value: `\u200b`
                }
            ],
            user: (data instanceof Interaction) ? data.user : data.author
        });

        if(TargetMember.presence?.activities)
            for(let activity of TargetMember.presence?.activities) {
                if(activity.type === "CUSTOM")
                     embed.addField( `✨  ${activity.name}`, `${!activity.emoji ? '' : `${activity.emoji?.identifier.startsWith('%') ? activity.emoji?.name : '<' + activity.emoji?.identifier + '>'}`}  ${activity.state === null ? '' : activity.state}
                     \u200b`, true);
                else {
                    let emoji = "";
                    switch(activity.type) {
                        case "PLAYING":
                            emoji = "🕹  ";
                            break;
                        case "STREAMING":
                            emoji = "🔴  ";
                            break;
                        case "LISTENING":
                            emoji = "🎵  ";
                            break;
                        case "WATCHING":
                            emoji = "📺  ";
                            break;
                        case "COMPETING":
                            emoji = "🌠  ";
                            break;
                    }
                    embed.addField( `${emoji}${activity.type.toLowerCase().charAt(0).toUpperCase() + activity.type.toLowerCase().slice(1)} ${activity.name}`, 
                    `${activity.details === null ? '' : activity.details}
                    ${activity.state === null ? '' : activity.state}
                    Since <t:${Math.round(new Date(activity.createdAt).getTime() / 1000)}:R>
                    \u200b`, true);
                }
            }

        embed.addField(`📰  Information on this guild`, `${
            (TargetMember.joinedAt === null) ? 'Cannot determine joined date' : `Joined <t:${Math.round(TargetMember.joinedAt.getTime() / 1000)}:R>`}
            ${(TargetMember.id === data.guild!.ownerId) ? 'Owner of this guild 👑' : ''}
            `);
        
        try {
            const colorthief = await getColorFromURL(TargetMember.user.displayAvatarURL().replace('.webp', '.jpg'));     
            embed.setColor(colorthief);
        } catch (err) {

        }

        embed.setThumbnail(TargetMember.user.displayAvatarURL());
        embed.setAuthor(`${TargetMember.displayName}`, TargetMember.user.displayAvatarURL());

        return await sendMessageOrInteractionResponse(data, { embeds: [embed] });

    }
}