import { Database } from 'bun:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from '../paths.ts';
import type { LegacyDutyData } from '../types.ts';

/** Bumped whenever the schema below changes; stored in `PRAGMA user_version`. */
const SCHEMA_VERSION = 1;

/** `DUTY_DB_PATH` exists so tests can point at `:memory:` instead of the real database. */
const dbPath = process.env.DUTY_DB_PATH ?? join(projectRoot, 'data', 'duty.db');

/** Pre-SQLite storage, kept in the repo as the one-time migration source. */
const legacyJsonPath = join(projectRoot, 'data', 'duty.json');

let instance: Database | null = null;

/**
 * Opens the database on first use, running the pragmas and migration once.
 *
 * Deliberately lazy: `deploy-commands.ts` imports every command module, and those import
 * `utils/duty.ts` — but deploying slash commands needs no duty state at all. Connecting at
 * module load would make an unwritable `data/` break the deploy step for no reason.
 */
export function getDb(): Database {
    if (instance !== null) return instance;

    const db = new Database(dbPath, { create: true });
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    migrate(db);
    instance = db;
    return db;
}

function createSchema(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS duty_order (
            position INTEGER PRIMARY KEY,
            user_id  TEXT    NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS duty_state (
            id            INTEGER PRIMARY KEY CHECK (id = 1),
            current_index INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS reroll_stack (
            seq         INTEGER PRIMARY KEY AUTOINCREMENT,
            index_value INTEGER NOT NULL
        );
    `);
}

/**
 * Reads the duty order out of the legacy JSON file, if it is still there.
 *
 * The file's legacy scalar `rerollIndex` key is deliberately ignored: the JSON-era code read
 * `currentIndex ?? 0` and `rerollIndices ?? []`, so importing as index 0 with an empty reroll
 * stack reproduces the old runtime behaviour exactly.
 */
function readLegacyOrder(): string[] {
    if (!existsSync(legacyJsonPath)) return [];

    let order: unknown;
    try {
        order = (JSON.parse(readFileSync(legacyJsonPath, 'utf8')) as LegacyDutyData).order;
    } catch (error) {
        console.warn(`Could not parse ${legacyJsonPath}; starting with an empty duty order.`, error);
        return [];
    }

    if (!Array.isArray(order)) {
        console.warn(`${legacyJsonPath} has no "order" array; starting with an empty duty order.`);
        return [];
    }

    const ids = order.filter((id): id is string => typeof id === 'string' && id !== '');
    // `duty_order.user_id` is UNIQUE, so duplicates would abort the import entirely.
    const deduped = [...new Set(ids)];
    if (deduped.length !== ids.length) {
        console.warn(`${legacyJsonPath} contains duplicate ids; keeping the first occurrence of each.`);
    }
    return deduped;
}

function migrate(db: Database): void {
    const version = db.query<{ user_version: number }, []>('PRAGMA user_version').get();
    if ((version?.user_version ?? 0) >= SCHEMA_VERSION) return;

    const legacyOrder = readLegacyOrder();

    db.transaction(() => {
        createSchema(db);
        db.query('INSERT OR IGNORE INTO duty_state (id, current_index) VALUES (1, 0)').run();

        // Only seed an empty table, so a database that already holds an order is never touched.
        const existing = db.query<{ count: number }, []>(
            'SELECT COUNT(*) AS count FROM duty_order',
        ).get();
        if ((existing?.count ?? 0) === 0 && legacyOrder.length > 0) {
            const insert = db.query('INSERT INTO duty_order (position, user_id) VALUES (?, ?)');
            legacyOrder.forEach((id, position) => insert.run(position, id));
            console.log(`Imported ${legacyOrder.length} duty entries from ${legacyJsonPath}.`);
        }
    })();

    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
