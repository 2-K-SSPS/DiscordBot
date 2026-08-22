import { beforeEach, describe, expect, test } from 'bun:test';

process.env.DUTY_DB_PATH = ':memory:';

// Dynamic import so DUTY_DB_PATH is set before `utils/db.ts` opens the database.
const { getDb } = await import('./db.ts');
const {
    addToDuty,
    completeDuty,
    getCurrentDuty,
    getDutyList,
    getFullList,
    getLastCompletedWeek,
    getRerollState,
    getStringList,
    removeFromDuty,
    repeatDuty,
    rerollDuty,
    undoRerollDuty,
} = await import('./duty.ts');

const ORDER = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'];

function seed(order: string[]): void {
    getDb().query('DELETE FROM duty_order').run();
    getDb().query('DELETE FROM reroll_stack').run();
    getDb().query('UPDATE duty_state SET current_index = 0 WHERE id = 1').run();
    const insert = getDb().query('INSERT INTO duty_order (position, user_id) VALUES (?, ?)');
    order.forEach((id, position) => insert.run(position, id));
}

function currentIndex(): number {
    return getRerollState().currentIndex;
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
        expect(version?.user_version).toBe(2);
        expect(currentIndex()).toBe(0);
    });

    test('v2 seeds the current week so a fresh start does not announce twice', () => {
        expect(getLastCompletedWeek()).toMatch(/^\d{4}-W\d{2}$/);
    });
});

describe('completeDuty', () => {
    test('moves the head to the tail and persists', () => {
        expect(completeDuty().list).toEqual(['b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'a1']);
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

    test('records the week only when one is supplied', () => {
        const before = getLastCompletedWeek();
        completeDuty();
        expect(getLastCompletedWeek()).toBe(before); // a manual /complete must not cancel Monday
        completeDuty('2026-W34');
        expect(getLastCompletedWeek()).toBe('2026-W34');
    });

    test('reports failure on an empty order instead of announcing', () => {
        seed([]);
        const result = completeDuty();
        expect(result.changed).toBe(false);
        expect(result.reason).toBe('empty-order');
        expect(getDutyList()).toEqual([]);
    });

    test('an empty order leaves the week unrecorded, so the catch-up retries', () => {
        seed([]);
        completeDuty('2026-W35');
        expect(getLastCompletedWeek()).not.toBe('2026-W35');
    });
});

describe('repeatDuty', () => {
    test('moves the tail back to the head', () => {
        expect(repeatDuty().list).toEqual(['g7', 'a1', 'b2', 'c3', 'd4', 'e5', 'f6']);
        expect(getDutyList()).toEqual(['g7', 'a1', 'b2', 'c3', 'd4', 'e5', 'f6']);
        expect(currentIndex()).toBe(0);
    });

    test('reports failure on an empty order', () => {
        seed([]);
        expect(repeatDuty()).toMatchObject({ changed: false, reason: 'empty-order' });
    });
});

describe('rerollDuty', () => {
    test('promotes the next person, not the one already on duty', () => {
        // The whole point of the fix: one reroll must actually change who is on duty.
        const result = rerollDuty();
        expect(result.changed).toBe(true);
        expect(result.list).toEqual(['b2', 'a1', 'c3', 'd4', 'e5', 'f6', 'g7']);
        expect(getCurrentDuty(result.list)).toBe('b2');
        expect(currentIndex()).toBe(1);
        expect(rerollStack()).toEqual([1]);
    });

    test('a second reroll reaches past everyone already skipped', () => {
        rerollDuty();
        expect(rerollDuty().list).toEqual(['c3', 'b2', 'a1', 'd4', 'e5', 'f6', 'g7']);
        expect(currentIndex()).toBe(2);
        expect(rerollStack()).toEqual([1, 2]);
    });

    test('the skipped person is on duty the following week', () => {
        seed(['a1', 'b2', 'c3', 'd4']);
        rerollDuty(); // a1 is away, b2 takes over
        expect(getCurrentDuty(completeDuty('2026-W34').list)).toBe('a1');
    });

    test('reports failure once everyone has been skipped', () => {
        seed(['x1', 'y2']);
        rerollDuty();
        const stack = rerollStack();

        const result = rerollDuty();
        expect(result).toMatchObject({ changed: false, reason: 'no-reroll-target' });
        expect(getDutyList()).toEqual(['y2', 'x1']);
        expect(rerollStack()).toEqual(stack); // nothing pushed on the aborted reroll
        expect(currentIndex()).toBe(1);
    });

    test('reports failure on an empty order', () => {
        seed([]);
        expect(rerollDuty()).toMatchObject({ changed: false, reason: 'empty-order' });
    });
});

describe('undoRerollDuty', () => {
    test('one undo puts the promoted person exactly back', () => {
        rerollDuty();
        expect(undoRerollDuty().list).toEqual(ORDER);
        expect(currentIndex()).toBe(0);
        expect(rerollStack()).toEqual([]);
    });

    test('two rerolls followed by two undos restore the original order', () => {
        rerollDuty();
        rerollDuty();
        undoRerollDuty();
        expect(getDutyList()).toEqual(['b2', 'a1', 'c3', 'd4', 'e5', 'f6', 'g7']);
        expect(currentIndex()).toBe(1);

        undoRerollDuty();
        expect(getDutyList()).toEqual(ORDER);
        expect(rerollStack()).toEqual([]);
        expect(currentIndex()).toBe(0);
    });

    test('reports failure with an empty reroll stack', () => {
        const result = undoRerollDuty();
        expect(result).toMatchObject({ changed: false, reason: 'nothing-to-undo' });
        expect(getDutyList()).toEqual(ORDER);
        expect(currentIndex()).toBe(0);
    });
});

describe('addToDuty', () => {
    test('appends to the tail and reports what was skipped', () => {
        const result = addToDuty(['h8', 'a1', 'i9']);
        expect(result.added).toEqual(['h8', 'i9']);
        expect(result.skipped).toEqual(['a1']);
        expect(getDutyList()).toEqual([...ORDER, 'h8', 'i9']);
    });

    test('deduplicates within a single call', () => {
        expect(addToDuty(['h8', 'h8']).added).toEqual(['h8']);
        expect(getDutyList()).toEqual([...ORDER, 'h8']);
    });

    test('clears the now-meaningless reroll state', () => {
        rerollDuty();
        expect(rerollStack()).not.toEqual([]);
        addToDuty(['h8']);
        expect(rerollStack()).toEqual([]);
        expect(currentIndex()).toBe(0);
    });

    test('adding nobody leaves the reroll state alone', () => {
        rerollDuty();
        addToDuty(['a1']); // already present
        expect(rerollStack()).toEqual([1]);
        expect(currentIndex()).toBe(1);
    });
});

describe('removeFromDuty', () => {
    test('removes and reports whether the person was on duty', () => {
        expect(removeFromDuty('c3')).toMatchObject({ removed: true, wasOnDuty: false });
        expect(getDutyList()).toEqual(['a1', 'b2', 'd4', 'e5', 'f6', 'g7']);
    });

    test('flags removing the person currently on duty', () => {
        const result = removeFromDuty('a1');
        expect(result).toMatchObject({ removed: true, wasOnDuty: true });
        expect(getCurrentDuty(result.list)).toBe('b2');
    });

    test('is a no-op for someone not in the order', () => {
        rerollDuty();
        expect(removeFromDuty('nope')).toMatchObject({ removed: false });
        expect(getDutyList()).toEqual(['b2', 'a1', 'c3', 'd4', 'e5', 'f6', 'g7']);
        expect(rerollStack()).toEqual([1]); // untouched, since nothing moved
    });

    test('clears the now-meaningless reroll state', () => {
        rerollDuty();
        removeFromDuty('g7');
        expect(rerollStack()).toEqual([]);
        expect(currentIndex()).toBe(0);
    });
});

describe('getStringList', () => {
    test('marks the head and truncates only when there is more to show', () => {
        expect(getStringList(['a1', 'b2'])).toBe('<@a1> :rewind: <@b2>');
        expect(getStringList(ORDER)).toBe(
            '<@a1> :rewind: <@b2> <@c3> <@d4> <@e5> <@f6>...',
        );
    });

    test('an empty list renders as nothing, not a bare ellipsis', () => {
        expect(getStringList([])).toBe('');
    });
});

describe('getFullList', () => {
    test('marks the head, the people skipped this week and everyone else', () => {
        const rendered = getFullList(['c3', 'b2', 'a1', 'd4'], 2);
        expect(rendered.split('\n')).toEqual([
            '▶ `1.` <@c3>',
            '↩ `2.` <@b2>',
            '↩ `3.` <@a1>',
            '· `4.` <@d4>',
        ]);
    });

    test('an empty order says so', () => {
        expect(getFullList([], 0)).toBe('Pořadník je prázdný.');
    });

    test('stays inside Discord\'s message limit', () => {
        const many = Array.from({ length: 400 }, (_, i) => String(100000000000000000n + BigInt(i)));
        const rendered = getFullList(many, 0);
        expect(rendered.length).toBeLessThanOrEqual(2000);
        expect(rendered).toContain('…a další');
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
