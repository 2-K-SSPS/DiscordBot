import type {
    ChatInputCommandInteraction,
    Collection,
    SharedSlashCommand,
} from 'discord.js';

/** A single slash command module, as exported by every file under `commands/`. */
export interface Command {
    data: SharedSlashCommand;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

/** Shape of `config.json` (untracked — see `config.example.json`). */
export interface Config {
    token: string;
    clientId: string;
    guildId: string;
    /** Channel the weekly cron announcement is posted to. */
    cronDutyChannelId: string;
    /** Channel `/announce`, `/complete`, `/repeat` and `/reroll` post to. */
    commandDutyChannelId: string;
}

/** Shape of `data/duty.json`. */
export interface DutyData {
    order: string[];
    rerollIndices?: number[] | null;
    currentIndex?: number;
}

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command>;
    }
}
