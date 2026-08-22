import {
    DISCORD_MESSAGE_LIMIT,
    DUTY_LIST_PREVIEW_LENGTH,
} from '../constants.ts';
import { getDb } from './db.ts';

/** Why a mutation did nothing, so the command can say so instead of faking success. */
export type DutyFailure = 'empty-order' | 'no-reroll-target' | 'nothing-to-undo';

export interface DutyChange {
    /** The order after the attempt — unchanged when `changed` is false. */
    list: string[];
    changed: boolean;
    reason?: DutyFailure;
}

export interface AddResult {
    list: string[];
    added: string[];
    /** Ids that were already in the order, or belong to a bot. */
    skipped: string[];
}

export interface RemoveResult {
    list: string[];
    removed: boolean;
    /** True when the removed person was the one on duty, so the reply can call it out. */
    wasOnDuty: boolean;
}

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

function countRerollStack(): number {
    const row = getDb()
        .query<{ count: number }, []>('SELECT COUNT(*) AS count FROM reroll_stack')
        .get();
    return row?.count ?? 0;
}

/**
 * Forgets every reroll made this week.
 *
 * Called after any roster change: both `current_index` and the stack hold *positions*, so adding
 * or removing anyone leaves them pointing at the wrong people.
 */
function resetRerollState(): void {
    setCurrentIndex(0);
    clearRerollStack();
}

export function getDutyList(): string[] {
    return readOrder();
}

/** The reroll bookkeeping behind `/roster`, so an admin can see what `/undo-reroll` will act on. */
export function getRerollState(): { currentIndex: number; stackDepth: number } {
    return { currentIndex: readCurrentIndex(), stackDepth: countRerollStack() };
}

/** The ISO week whose announcement was last posted, or `null` before any has been. */
export function getLastCompletedWeek(): string | null {
    const row = getDb()
        .query<{ last_completed_week: string | null }, []>(
            'SELECT last_completed_week FROM duty_state WHERE id = 1',
        )
        .get();
    return row?.last_completed_week ?? null;
}

function setLastCompletedWeek(weekKey: string): void {
    getDb().query('UPDATE duty_state SET last_completed_week = ? WHERE id = 1').run(weekKey);
}

/**
 * Wraps a mutator in a transaction, prepared on first call rather than at import time.
 *
 * Every mutator reads, mutates and writes inside a single synchronous transaction, so two
 * overlapping interactions can no longer clobber each other's writes.
 */
function transactional<A extends unknown[], T>(mutate: (...args: A) => T): (...args: A) => T {
    let wrapped: ((...args: A) => T) | null = null;
    return (...args: A) => {
        wrapped ??= getDb().transaction(mutate);
        return wrapped(...args);
    };
}

/**
 * Moves the person on duty to the back of the order.
 *
 * `weekKey` is passed only by the weekly announcement (cron or startup catch-up) and records that
 * the week's rotation has happened. A manual `/complete` deliberately leaves it alone, so forcing
 * a duty to finish early does not also cancel the coming Monday.
 */
export const completeDuty = transactional((weekKey?: string): DutyChange => {
    const list = readOrder();
    const completed = list.shift();
    if (completed === undefined) return { list, changed: false, reason: 'empty-order' };

    list.push(completed);
    persistOrder(list);
    resetRerollState();
    if (weekKey !== undefined) setLastCompletedWeek(weekKey);
    return { list, changed: true };
});

export const repeatDuty = transactional((): DutyChange => {
    const list = readOrder();
    const repeat = list.pop();
    if (repeat === undefined) return { list, changed: false, reason: 'empty-order' };

    list.unshift(repeat);
    persistOrder(list);
    resetRerollState();
    return { list, changed: true };
});

/**
 * Skips the person on duty in favour of the next one down the order.
 *
 * The skipped person stays directly behind the promoted one, so the following week's
 * `completeDuty` brings them back to the head — "bude mít službu příští týden".
 *
 * `current_index` counts how many people have been skipped this week, so repeated rerolls keep
 * reaching further down the order instead of re-promoting someone already skipped.
 */
export const rerollDuty = transactional((): DutyChange => {
    const list = readOrder();
    if (list.length === 0) return { list, changed: false, reason: 'empty-order' };

    const origin = readCurrentIndex() + 1;
    const [promoted] = list.splice(origin, 1);
    // Out of range: everyone in the order has already been skipped this week.
    if (promoted === undefined) return { list, changed: false, reason: 'no-reroll-target' };

    pushRerollIndex(origin);
    list.unshift(promoted);
    persistOrder(list);
    setCurrentIndex(origin);
    return { list, changed: true };
});

/** Exact inverse of the most recent `rerollDuty`: the head goes back where it was taken from. */
export const undoRerollDuty = transactional((): DutyChange => {
    const list = readOrder();

    const previous = peekRerollIndex();
    if (previous === null) return { list, changed: false, reason: 'nothing-to-undo' };

    const [promoted] = list.splice(0, 1);
    if (promoted === undefined) return { list, changed: false, reason: 'empty-order' };

    deleteRerollIndex(previous.seq);
    list.splice(previous.index_value, 0, promoted);
    persistOrder(list);
    setCurrentIndex(Math.max(0, previous.index_value - 1));
    return { list, changed: true };
});

/** Appends ids to the end of the order, ignoring anyone already in it. */
export const addToDuty = transactional((ids: string[]): AddResult => {
    const list = readOrder();
    const present = new Set(list);
    const added: string[] = [];
    const skipped: string[] = [];

    for (const id of ids) {
        if (present.has(id)) {
            skipped.push(id);
            continue;
        }
        present.add(id);
        list.push(id);
        added.push(id);
    }

    if (added.length === 0) return { list, added, skipped };

    persistOrder(list);
    resetRerollState();
    return { list, added, skipped };
});

export const removeFromDuty = transactional((id: string): RemoveResult => {
    const list = readOrder();
    const index = list.indexOf(id);
    if (index === -1) return { list, removed: false, wasOnDuty: false };

    list.splice(index, 1);
    persistOrder(list);
    resetRerollState();
    return { list, removed: true, wasOnDuty: index === 0 };
});

/** Short one-line preview of the order, for `/list` and the command confirmations. */
export function getStringList(list: string[]): string {
    const shown = list
        .slice(0, DUTY_LIST_PREVIEW_LENGTH)
        .map((id, i) => (i === 0 ? `<@${id}> :rewind:` : `<@${id}>`))
        .join(' ');
    return list.length > DUTY_LIST_PREVIEW_LENGTH ? `${shown}...` : shown;
}

/** Leaves room for `/roster`'s footer inside Discord's message limit. */
const FULL_LIST_BUDGET = DISCORD_MESSAGE_LIMIT - 200;

/**
 * The whole order, one person per line, for `/roster`.
 *
 * Positions `1..currentIndex` are exactly the people skipped this week: `rerollDuty` promotes from
 * `currentIndex` and unshifts, which leaves each skipped person one slot further down.
 */
export function getFullList(list: string[], currentIndex: number): string {
    if (list.length === 0) return 'Pořadník je prázdný.';

    const lines: string[] = [];
    let used = 0;
    let truncatedAt = -1;
    const width = String(list.length).length;

    for (const [i, id] of list.entries()) {
        const marker = i === 0 ? '▶' : i <= currentIndex ? '↩' : '·';
        const line = `${marker} \`${String(i + 1).padStart(width)}.\` <@${id}>`;
        if (used + line.length + 1 > FULL_LIST_BUDGET) {
            truncatedAt = i;
            break;
        }
        lines.push(line);
        used += line.length + 1;
    }

    if (truncatedAt !== -1) lines.push(`-# …a další ${list.length - truncatedAt}`);
    return lines.join('\n');
}

/** The person currently on duty — the head of the order. */
export function getCurrentDuty(list: string[]): string {
    const current = list[0];
    if (current === undefined) {
        throw new Error('Duty order is empty — nobody is on duty.');
    }
    return current;
}
