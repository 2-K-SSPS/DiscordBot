import { DUTY_LIST_PREVIEW_LENGTH } from '../constants.ts';
import { getDb } from './db.ts';

function readOrder(): string[] {
    return getDb()
        .query<{ user_id: string }, []>('SELECT user_id FROM duty_order ORDER BY position')
        .all()
        .map((row) => row.user_id);
}

/** Replaces the stored order wholesale. Must only be called inside a transaction. */
function persistOrder(list: string[]): void {
    getDb().query('DELETE FROM duty_order').run();
    const insert = getDb().query('INSERT INTO duty_order (position, user_id) VALUES (?, ?)');
    list.forEach((id, position) => insert.run(position, id));
}

function readCurrentIndex(): number {
    const row = getDb()
        .query<{ current_index: number }, []>('SELECT current_index FROM duty_state WHERE id = 1')
        .get();
    return row?.current_index ?? 0;
}

function setCurrentIndex(index: number): void {
    getDb().query('UPDATE duty_state SET current_index = ? WHERE id = 1').run(index);
}

function pushRerollIndex(index: number): void {
    getDb().query('INSERT INTO reroll_stack (index_value) VALUES (?)').run(index);
}

/** Top of the reroll stack without removing it, so a guard can bail out without mutating. */
function peekRerollIndex(): { seq: number; index_value: number } | null {
    return getDb()
        .query<{ seq: number; index_value: number }, []>(
            'SELECT seq, index_value FROM reroll_stack ORDER BY seq DESC LIMIT 1',
        )
        .get();
}

function deleteRerollIndex(seq: number): void {
    getDb().query('DELETE FROM reroll_stack WHERE seq = ?').run(seq);
}

function clearRerollStack(): void {
    getDb().query('DELETE FROM reroll_stack').run();
}

export function getDutyList(): string[] {
    return readOrder();
}

/**
 * Wraps a mutator in a transaction, prepared on first call rather than at import time.
 *
 * Every mutator reads, mutates and writes inside a single synchronous transaction, so two
 * overlapping interactions can no longer clobber each other's writes.
 */
function transactional(mutate: () => string[]): () => string[] {
    let wrapped: (() => string[]) | null = null;
    return () => {
        wrapped ??= getDb().transaction(mutate);
        return wrapped();
    };
}

export const completeDuty = transactional((): string[] => {
    const list = readOrder();
    const completed = list.shift();
    if (completed === undefined) return list;
    list.push(completed);
    persistOrder(list);
    setCurrentIndex(0); // Reset reroll indices and current index
    clearRerollStack();
    return list;
});

export const repeatDuty = transactional((): string[] => {
    const list = readOrder();
    const repeat = list.pop();
    if (repeat === undefined) return list;
    list.unshift(repeat);
    persistOrder(list);
    setCurrentIndex(0);
    clearRerollStack();
    return list;
});

export const rerollDuty = transactional((): string[] => {
    const list = readOrder();
    const currentIndex = readCurrentIndex();

    const [newCurrent] = list.splice(currentIndex, 1);
    if (newCurrent === undefined) return list;

    pushRerollIndex(currentIndex); // Store the current index before rerolling
    list.splice(0, 0, newCurrent);
    persistOrder(list);
    setCurrentIndex(currentIndex + 1);
    return list;
});

export const undoRerollDuty = transactional((): string[] => {
    const list = readOrder();

    const previous = peekRerollIndex();
    if (previous === null) return list; // Nothing to undo

    const [newCurrent] = list.splice(0, 1);
    if (newCurrent === undefined) return list;

    deleteRerollIndex(previous.seq);
    list.splice(previous.index_value, 0, newCurrent);
    persistOrder(list);
    setCurrentIndex(Math.max(0, previous.index_value)); // Prevent negative index
    return list;
});

export function getStringList(list: string[]): string {
    let stringList = '';
    list.every((id, i) => {
        if (i >= DUTY_LIST_PREVIEW_LENGTH) return false;
        stringList += i === 0 ? `<@${id}> :rewind:` : ` <@${id}>`;
        return true;
    });
    stringList += '...';
    return stringList;
}

/** The person currently on duty — the head of the order. */
export function getCurrentDuty(list: string[]): string {
    const current = list[0];
    if (current === undefined) {
        throw new Error('Duty order is empty — nobody is on duty.');
    }
    return current;
}
