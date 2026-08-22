import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '../config.ts';
import type { Command } from '../types.ts';

function isCommand(value: unknown): value is Command {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<Command>;
    return typeof candidate.data === 'object' && typeof candidate.execute === 'function';
}

/**
 * Load every command module from the `commands/<folder>/` tree.
 *
 * Shared by the bot and the deploy script so the two can never disagree about
 * which commands exist.
 */
export async function loadCommands(): Promise<Command[]> {
    const commands: Command[] = [];
    const foldersPath = join(projectRoot, 'commands');

    for (const folder of readdirSync(foldersPath)) {
        const commandsPath = join(foldersPath, folder);
        const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.ts'));

        for (const file of commandFiles) {
            const filePath = join(commandsPath, file);
            const imported: unknown = (await import(pathToFileURL(filePath).href)).default;

            if (isCommand(imported)) {
                commands.push(imported);
            } else {
                console.log(
                    `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
                );
            }
        }
    }

    return commands;
}
