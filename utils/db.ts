import { Database } from 'bun:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from '../paths.ts';
import type { LegacyDutyData } from '../types.ts';
import { dutyWeekKey } from './week.ts';

/** Bumped whenever the schema below changes; stored in `PRAGMA user_version`. */
const SCHEMA_VERSION = 2;

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
    migrateDatabase(db);
    instance = db;
    return db;
}

export function createSchema(db: Database): void {
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

/**
 * The v1 schema, kept verbatim rather than folded into later versions.
 *
 * A fresh database therefore takes the same path as an existing one — create v1, then apply every
 * later step — so the two can never drift into subtly different shapes.
 */
function migrateToV1(db: Database, legacyOrder: string[]): void {
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
}

/**
 * Adds the weekly idempotency key and drops this week's reroll bookkeeping.
 *
 * The stack is cleared because v2 changes what `reroll_stack.index_value` means: it used to be the
 * index the promoted person was taken *from* under an off-by-one `rerollDuty`, and is now the true
 * origin index. Replaying an old value through the corrected undo would reinsert to the wrong slot.
 *
 * `current_index` is reset with it. The two are halves of one "who has been skipped this week"
 * state, so clearing only the stack would leave the order claiming skips that nothing can undo.
 * Both are reset by the Monday rotation anyway, so at most one week of reroll history is lost.
 */
function migrateToV2(db: Database): void {
    db.exec('ALTER TABLE duty_state ADD COLUMN last_completed_week TEXT');
    db.query('DELETE FROM reroll_stack').run();
    db.query('UPDATE duty_state SET current_index = 0 WHERE id = 1').run();

    // Seed the current week so the first start after this migration does not mistake "never
    // recorded" for "the Monday announcement was missed" and post a duplicate.
    db.query('UPDATE duty_state SET last_completed_week = ? WHERE id = 1').run(
        dutyWeekKey(new Date()),
    );
}

/**
 * Brings `db` up to `SCHEMA_VERSION`.
 *
 * Exported so tests can drive the upgrade path against a hand-built v1 database; `getDb` is the
 * only caller in production.
 */
export function migrateDatabase(db: Database): void {
    const version = db.query<{ user_version: number }, []>('PRAGMA user_version').get();
    const current = version?.user_version ?? 0;
    if (current >= SCHEMA_VERSION) return;

    // Read before opening the transaction: file I/O has no business inside one.
    const legacyOrder = current < 1 ? readLegacyOrder() : [];

    db.transaction(() => {
        if (current < 1) migrateToV1(db, legacyOrder);
        if (current < 2) migrateToV2(db);
        // `user_version` is part of the database header and participates in the transaction, so
        // an interrupted migration rolls back the version stamp along with the schema.
        db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    })();
}
