import { User as PrismaUser, Guild as PrismaGuild } from '@prisma/client';
import {
    Message,
    ActionRowBuilder,
    CommandInteraction,
    ButtonInteraction,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import DiscordModule, { HybridInteractionMessage } from '../../utils/DiscordModule';
import {
    makeInfoEmbed,
    makeErrorEmbed,
    sendHybridInteractionMessageResponse,
    makeSuccessEmbed
} from '../../utils/DiscordMessage';

import DiscordMusicPlayer from '../../providers/DiscordMusicPlayerTempFix';
import Users from '../../services/Users';
import Cache from '../../providers/Cache';
import VRChatAPI from '../../providers/VRChatAPI';

const EMBEDS = {
    DEBUG_INFO: (data: HybridInteractionMessage) => {
        return makeInfoEmbed({
            title: 'VRC Login',
            description: `Login to VRChat account`,
            fields: [
                {
                    name: 'Available arguments',
                    value: '``emailOtp``'
                }
            ],
            user: data.getUser()
        });
    },
    NO_OTP_ERROR: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: 'No OTP provided',
            description: ``,
            user: data.getUser()
        });
    },
    OTP_ERROR: (data: HybridInteractionMessage, error: any) => {
        return makeErrorEmbed({
            title: 'Failed to verify OTP',
            description: `${error.message}`,
            user: data.getUser()
        });
    },
    EMAIL_OTP_SUCCESS: (data: HybridInteractionMessage) => {
        return makeSuccessEmbed({
            title: 'Logged in',
            description: `Successfully logged in to VRChat account, auth cookie has been logged to console`,
            user: data.getUser()
        });
    },
    ALREADY_LOGGED_IN: (data: HybridInteractionMessage) => {
        return makeSuccessEmbed({
            title: 'Already logged in',
            description: `You are already logged in to VRChat account`,
            user: data.getUser()
        });
    },
    NOT_DEVELOPER: (data: HybridInteractionMessage) => {
        return makeErrorEmbed({
            title: 'Developer only',
            description: `This command is restricted to the developers only`,
            user: data.getUser()
        });
    }
};

export default class Debug extends DiscordModule {
    public id = 'VRChatLogin';
    public commands = ['vrchatlogin', 'vrclogin'];
    public commandInteractionName = 'vrclogin';

    async GuildOnModuleCommand(args: any, message: Message) {
        await this.run(new HybridInteractionMessage(message), args);
    }

    async GuildModuleCommandInteractionCreate(interaction: CommandInteraction) {
        await this.run(new HybridInteractionMessage(interaction), interaction.options);
    }

    async run(data: HybridInteractionMessage, args: any) {
        const guild = data.getGuild();
        const user = data.getUser();
        const channel = data.getChannel();

        if (!guild || !user || !channel) return;

        if (!Users.isDeveloper(user.id))
            return await sendHybridInteractionMessageResponse(data, {
                embeds: [EMBEDS.NOT_DEVELOPER(data)]
            });

        const funct = {
            emailOtp: async (data: HybridInteractionMessage) => {
                if (VRChatAPI.isReady())
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.ALREADY_LOGGED_IN(data)]
                    });

                let otp: string | null | undefined;
                if (data.isMessage()) {
                    let _name: string;
                    if (typeof args[1] === 'undefined')
                        return await sendHybridInteractionMessageResponse(data, {
                            embeds: [EMBEDS.NO_OTP_ERROR(data)]
                        });

                    let __name = args;
                    __name.shift();
                    _name = __name.join(' ');
                    otp = _name;
                } else if (data.isApplicationCommand())
                    otp = data.getSlashCommand().options.get('otp', true).value?.toString();

                if (otp === null || typeof otp === 'undefined')
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.NO_OTP_ERROR(data)]
                    });

                let result: any;
                try {
                    result = await VRChatAPI.loginEmailOtp(otp);
                } catch (err) {
                    return await sendHybridInteractionMessageResponse(data, {
                        embeds: [EMBEDS.OTP_ERROR(data, err)]
                    });
                }

                await VRChatAPI.reInit();
                await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.EMAIL_OTP_SUCCESS(data)]
                });
            }
        };

        let query;

        if (data.isMessage()) {
            if (args.length === 0)
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.DEBUG_INFO(data)]
                });

            query = args[0].toLowerCase();
        } else if (data.isApplicationCommand()) {
            query = args.getSubcommand();
        }

        switch (query) {
            case 'info':
                return await sendHybridInteractionMessageResponse(data, {
                    embeds: [EMBEDS.DEBUG_INFO(data)]
                });
            case 'emailotp':
                return await funct.emailOtp(data);
        }
    }
}
