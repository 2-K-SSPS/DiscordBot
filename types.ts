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

/**
 * Shape of the legacy `data/duty.json`. Live state now lives in SQLite (`utils/db.ts`); this
 * interface only describes the file as a one-time migration source.
 */
export interface LegacyDutyData {
    order: string[];
    /** Dead key present in the shipped file — never read by the JSON-era code, so not imported. */
    rerollIndex?: number;
    rerollIndices?: number[] | null;
    currentIndex?: number;
}

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command>;
    }
}
