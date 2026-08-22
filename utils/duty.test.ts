import { beforeEach, describe, expect, test } from 'bun:test';

process.env.DUTY_DB_PATH = ':memory:';

// Dynamic import so DUTY_DB_PATH is set before `utils/db.ts` opens the database.
const { getDb } = await import('./db.ts');
const { completeDuty, getCurrentDuty, getDutyList, repeatDuty, rerollDuty, undoRerollDuty } =
    await import('./duty.ts');

const ORDER = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'];

function seed(order: string[]): void {
    getDb().query('DELETE FROM duty_order').run();
    getDb().query('DELETE FROM reroll_stack').run();
    getDb().query('UPDATE duty_state SET current_index = 0 WHERE id = 1').run();
    const insert = getDb().query('INSERT INTO duty_order (position, user_id) VALUES (?, ?)');
    order.forEach((id, position) => insert.run(position, id));
}

function currentIndex(): number {
    const row = getDb()
        .query<{ current_index: number }, []>('SELECT current_index FROM duty_state WHERE id = 1')
        .get();
    return row?.current_index ?? 0;
}

function rerollStack(): number[] {
    return getDb()
        .query<{ index_value: number }, []>('SELECT index_value FROM reroll_stack ORDER BY seq')
        .all()
        .map((row) => row.index_value);
}

beforeEach(() => seed(ORDER));

describe('migration', () => {
    test('the schema is created and versioned', () => {
        const version = getDb().query<{ user_version: number }, []>('PRAGMA user_version').get();
        expect(version?.user_version).toBe(1);
        expect(currentIndex()).toBe(0);
    });
});

describe('completeDuty', () => {
    test('moves the head to the tail and persists', () => {
        expect(completeDuty()).toEqual(['b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'a1']);
        expect(getDutyList()).toEqual(['b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'a1']);
    });

    test('resets the reroll state', () => {
        rerollDuty();
        rerollDuty();
        expect(rerollStack()).not.toEqual([]);
        completeDuty();
        expect(rerollStack()).toEqual([]);
        expect(currentIndex()).toBe(0);
    });

    test('is a no-op on an empty order', () => {
        seed([]);
        expect(completeDuty()).toEqual([]);
        expect(getDutyList()).toEqual([]);
    });
});

describe('repeatDuty', () => {
    test('moves the tail back to the head', () => {
        expect(repeatDuty()).toEqual(['g7', 'a1', 'b2', 'c3', 'd4', 'e5', 'f6']);
        expect(getDutyList()).toEqual(['g7', 'a1', 'b2', 'c3', 'd4', 'e5', 'f6']);
        expect(currentIndex()).toBe(0);
    });

    test('is a no-op on an empty order', () => {
        seed([]);
        expect(repeatDuty()).toEqual([]);
    });
});

describe('rerollDuty', () => {
    test('promotes the person at the current index and advances it', () => {
        // currentIndex 0: 'a1' is removed from 0 and reinserted at 0 — order unchanged.
        expect(rerollDuty()).toEqual(ORDER);
        expect(currentIndex()).toBe(1);
        expect(rerollStack()).toEqual([0]);

        // currentIndex 1: 'b2' is promoted to the head.
        expect(rerollDuty()).toEqual(['b2', 'a1', 'c3', 'd4', 'e5', 'f6', 'g7']);
        expect(currentIndex()).toBe(2);
        expect(rerollStack()).toEqual([0, 1]);
    });

    test('is a no-op once the current index runs off the end', () => {
        seed(['only']);
        rerollDuty();
        expect(currentIndex()).toBe(1);
        const stack = rerollStack();
        expect(rerollDuty()).toEqual(['only']);
        expect(getDutyList()).toEqual(['only']);
        expect(rerollStack()).toEqual(stack); // nothing pushed on the aborted reroll
        expect(currentIndex()).toBe(1);
    });
});

describe('undoRerollDuty', () => {
    test('two rerolls followed by two undos restore the original order', () => {
        rerollDuty();
        rerollDuty();
        undoRerollDuty();
        undoRerollDuty();
        expect(getDutyList()).toEqual(ORDER);
        expect(rerollStack()).toEqual([]);
        expect(currentIndex()).toBe(0);
    });

    test('is a no-op with an empty reroll stack', () => {
        expect(undoRerollDuty()).toEqual(ORDER);
        expect(getDutyList()).toEqual(ORDER);
        expect(currentIndex()).toBe(0);
    });
});

describe('getCurrentDuty', () => {
    test('returns the head of the order', () => {
        expect(getCurrentDuty(getDutyList())).toBe('a1');
    });

    test('throws on an empty order', () => {
        expect(() => getCurrentDuty([])).toThrow('Duty order is empty');
    });
});
