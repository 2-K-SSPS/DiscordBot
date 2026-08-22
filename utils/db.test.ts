import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

process.env.DUTY_DB_PATH = ':memory:';

const { createSchema, migrateDatabase } = await import('./db.ts');

/** A database exactly as the v1 code left it, mid-week with a reroll outstanding. */
function buildV1Database(): Database {
    const db = new Database(':memory:');
    createSchema(db);
    db.query('INSERT INTO duty_state (id, current_index) VALUES (1, 1)').run();
    db.query('INSERT INTO reroll_stack (index_value) VALUES (0)').run();
    const insert = db.query('INSERT INTO duty_order (position, user_id) VALUES (?, ?)');
    ['a1', 'b2', 'c3'].forEach((id, position) => insert.run(position, id));
    db.exec('PRAGMA user_version = 1');
    return db;
}

describe('v1 to v2 migration', () => {
    test('preserves the duty order untouched', () => {
        const db = buildV1Database();
        migrateDatabase(db);

        expect(
            db
                .query<{ user_id: string }, []>('SELECT user_id FROM duty_order ORDER BY position')
                .all()
                .map((row) => row.user_id),
        ).toEqual(['a1', 'b2', 'c3']);
    });

    test('drops both halves of the pre-fix reroll state together', () => {
        const db = buildV1Database();
        migrateDatabase(db);

        // The old index_value means something different now, so a leftover entry would undo to the
        // wrong slot — and a current_index without a stack would claim skips nothing can reverse.
        const stack = db.query<{ count: number }, []>(
            'SELECT COUNT(*) AS count FROM reroll_stack',
        ).get();
        expect(stack?.count).toBe(0);

        const state = db.query<{ current_index: number }, []>(
            'SELECT current_index FROM duty_state WHERE id = 1',
        ).get();
        expect(state?.current_index).toBe(0);
    });

    test('seeds the current week so the first start does not re-announce', () => {
        const db = buildV1Database();
        migrateDatabase(db);

        const state = db.query<{ last_completed_week: string | null }, []>(
            'SELECT last_completed_week FROM duty_state WHERE id = 1',
        ).get();
        expect(state?.last_completed_week).toMatch(/^\d{4}-W\d{2}$/);
    });

    test('stamps the new version and is a no-op when re-run', () => {
        const db = buildV1Database();
        migrateDatabase(db);
        expect(db.query<{ user_version: number }, []>('PRAGMA user_version').get()?.user_version)
            .toBe(2);

        // A second pass must not try to ALTER the column in again.
        expect(() => migrateDatabase(db)).not.toThrow();
    });
});
