import { Guild, Interaction, Message, GuildMember, CommandInteraction, ButtonInteraction, TextBasedChannel, MessageComponentInteraction, User, SelectMenuInteraction } from "discord.js";

export default class DiscordModule {

    public id?: string;
    public commands?: (string[] | null) = null;
    public commandInteractionName?: (string | null) = null;

    constructor({ id, command, commandInteractionName }: { 
        id?: string,
        command?: (string[] | null),
        commandInteractionName?: (string | null)
    } = {}) {
            this.id = id;
            this.commands = command;
            this.commandInteractionName = commandInteractionName;
    }

    Init(): (void | Promise<void | any>) {}
    Ready(): (void | Promise<void | any>) {}

    GuildOnCommand(command: string, args: any, message: Message): (void | Promise<void | any>) {}
    GuildOnModuleCommand(args: any, message: Message): (void | Promise<void | any>) {}

    GuildInteractionCreate(interaction: Interaction): (void | Promise<void | any>) {}
    GuildModuleInteractionCreate(interaction: Interaction): (void | Promise<void | any>) {}

    GuildCommandInteractionCreate(interaction: CommandInteraction): (void | Promise<void | any>) {}
    GuildModuleCommandInteractionCreate(interaction: CommandInteraction): (void | Promise<void | any>) {}

    GuildSelectMenuInteractionCreate(interaction: SelectMenuInteraction): (void | Promise<void | any>) {}

    GuildButtonInteractionCreate(interaction: ButtonInteraction): (void | Promise<void | any>) {}

    GuildCreate(guild: Guild): (void | Promise<void | any>) {}
    GuildMemberAdd(member: GuildMember): (void | Promise<void | any>) {}
    GuildMessageCreate(message: Message): (void | Promise<void | any>) {}
}

export class HybridInteractionMessage {
    public data: Interaction | Message;
    constructor (data: Interaction | Message) {
        this.data = data;
    }

    public isInteraction(): boolean {
        return this.data instanceof Interaction;
    }

    public isSlashCommand(): boolean {
        return this.data instanceof CommandInteraction && this.data.isCommand();
    }

    public isButton(): boolean {
        return this.data instanceof ButtonInteraction && this.data.isButton();
    }
    
    public isSelectMenu(): boolean {
        return this.data instanceof SelectMenuInteraction && this.data.isSelectMenu();
    }

    public isMessage(): boolean {
        return this.data instanceof Message;
    }

    public getChannel(): (TextBasedChannel | null) {
        return this.data.channel;
    }

    public getGuild(): (Guild | null) {
        return this.data.guild;
    }

    public getUser(): (User | null) {
        return (this.isInteraction()) ? this.getInteraction().user : this.getMessage().author
    }

    public getMember(): (GuildMember | null) {
        return (this.data.member as GuildMember);
    }

    public getInteraction(): Interaction {
        if(this.isMessage())
            throw new Error("Unable to cast interaction to message");

        return this.data as Interaction;
    }

    public getSlashCommand(): CommandInteraction {
        if(this.isInteraction() && !(this.data as CommandInteraction))
            throw new Error("Unable to cast to MessageComponentInteraction");

        return this.data as CommandInteraction;
    }

    public getSelectMenu(): SelectMenuInteraction {
        if(this.isInteraction() && !(this.data as SelectMenuInteraction))
            throw new Error("Unable to cast to SelectMenuInteraction");

        return this.data as SelectMenuInteraction;
    }

    public getMessageComponentInteraction(): MessageComponentInteraction {
        if(this.isInteraction() && !(this.data as MessageComponentInteraction))
            throw new Error("Unable to cast to MessageComponentInteraction");

        return this.data as MessageComponentInteraction;
    }

    public getMessage(): Message {
        if(this.isInteraction())
            throw new Error("Unable to cast message to interaction");

        return this.data as Message;
    }

    public getRaw(): (Interaction | Message) {
        return this.data;
    }
}