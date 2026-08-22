import { describe, expect, test } from 'bun:test';
import { dutyWeekKey, isPastWeeklyFireTime, isWeeklyDutyDue } from './week.ts';

describe('dutyWeekKey', () => {
    test('uses the ISO year, which can differ from the calendar year', () => {
        // 2025-12-29 is a Monday, and its week belongs to ISO year 2026.
        expect(dutyWeekKey(new Date('2025-12-29T12:00:00Z'))).toBe('2026-W01');
        expect(dutyWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
        // 2027-01-03 is a Sunday, still inside 2026's 53rd week.
        expect(dutyWeekKey(new Date('2027-01-03T12:00:00Z'))).toBe('2026-W53');
        expect(dutyWeekKey(new Date('2027-01-04T12:00:00Z'))).toBe('2027-W01');
    });

    test('the week is Prague-local, not UTC', () => {
        // Sunday 22:30 UTC is already Monday 00:30 in Prague, so it belongs to the *next* week.
        expect(dutyWeekKey(new Date('2026-08-23T21:00:00Z'))).toBe('2026-W34');
        expect(dutyWeekKey(new Date('2026-08-23T22:30:00Z'))).toBe('2026-W35');
    });

    test('a whole Prague week shares one key', () => {
        expect(dutyWeekKey(new Date('2026-08-24T05:40:00Z'))).toBe('2026-W35'); // Monday
        expect(dutyWeekKey(new Date('2026-08-30T21:59:00Z'))).toBe('2026-W35'); // Sunday 23:59
    });
});

describe('isPastWeeklyFireTime', () => {
    test('is false before Monday 07:40 and true from then on', () => {
        expect(isPastWeeklyFireTime(new Date('2026-08-24T05:39:00Z'))).toBe(false); // 07:39 CEST
        expect(isPastWeeklyFireTime(new Date('2026-08-24T05:40:00Z'))).toBe(true); // 07:40 CEST
    });

    test('handles the winter offset, so the cutoff tracks DST', () => {
        // Same wall-clock cutoff, one hour earlier in UTC because November is CET (+1), not CEST.
        expect(isPastWeeklyFireTime(new Date('2026-11-02T06:39:00Z'))).toBe(false);
        expect(isPastWeeklyFireTime(new Date('2026-11-02T06:40:00Z'))).toBe(true);
    });

    test('the rest of the week is always past the cutoff', () => {
        expect(isPastWeeklyFireTime(new Date('2026-08-25T00:10:00Z'))).toBe(true); // Tuesday
        expect(isPastWeeklyFireTime(new Date('2026-03-29T00:30:00Z'))).toBe(true); // DST-start Sunday
        expect(isPastWeeklyFireTime(new Date('2026-10-25T00:30:00Z'))).toBe(true); // DST-end Sunday
    });

    test('Monday just after midnight is not yet due', () => {
        expect(isPastWeeklyFireTime(new Date('2026-08-23T22:30:00Z'))).toBe(false); // Mon 00:30
    });
});

describe('isWeeklyDutyDue', () => {
    const monday0740 = new Date('2026-08-24T05:40:00Z');
    const monday0739 = new Date('2026-08-24T05:39:00Z');
    const wednesday = new Date('2026-08-26T12:00:00Z');

    test('is due at the cutoff when the week has not been announced', () => {
        expect(isWeeklyDutyDue(monday0740, '2026-W34')).toBe(true);
        expect(isWeeklyDutyDue(monday0740, null)).toBe(true);
    });

    test('is not due before the cutoff, however stale the record', () => {
        expect(isWeeklyDutyDue(monday0739, '2026-W34')).toBe(false);
        expect(isWeeklyDutyDue(monday0739, null)).toBe(false);
    });

    test('is idempotent once the week has been announced', () => {
        expect(isWeeklyDutyDue(monday0740, '2026-W35')).toBe(false);
        expect(isWeeklyDutyDue(wednesday, '2026-W35')).toBe(false);
    });

    test('a missed Monday is still due later in the week', () => {
        // What makes the daily tick self-healing rather than just noisy.
        expect(isWeeklyDutyDue(wednesday, '2026-W34')).toBe(true);
    });
});
