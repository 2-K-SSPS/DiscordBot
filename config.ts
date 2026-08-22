import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from './paths.ts';
import type { Config } from './types.ts';

function loadConfig(): Config {
    const configPath = join(projectRoot, 'config.json');

    let raw: string;
    try {
        raw = readFileSync(configPath, 'utf8');
    } catch {
        throw new Error(
            `Missing ${configPath}. Copy config.example.json to config.json and fill it in.`,
        );
    }

    const parsed = JSON.parse(raw) as Partial<Config>;
    const requiredKeys = [
        'token',
        'clientId',
        'guildId',
        'cronDutyChannelId',
        'commandDutyChannelId',
    ] as const;
    const missing = requiredKeys.filter(
        (key) => typeof parsed[key] !== 'string' || parsed[key] === '',
    );
    if (missing.length > 0) {
        throw new Error(`config.json is missing required key(s): ${missing.join(', ')}`);
    }

    return parsed as Config;
}

export const config = loadConfig();
