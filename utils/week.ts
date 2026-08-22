import {
    DUTY_TIMEZONE,
    WEEKLY_DUTY_HOUR,
    WEEKLY_DUTY_MINUTE,
    WEEKLY_DUTY_WEEKDAY,
} from '../constants.ts';

/**
 * Civil (wall-clock) time in `DUTY_TIMEZONE`, regardless of the host's own timezone.
 *
 * Everything here goes through `Intl.DateTimeFormat` rather than epoch arithmetic, so DST is
 * handled by the runtime's tz database instead of by hand — there is no local-to-epoch inversion
 * to get wrong twice a year.
 */
interface LocalParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    weekday: number;
}

const ISO_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DUTY_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // `h23` rather than `hour12: false`, which yields hour 24 for midnight on some ICU builds.
    hourCycle: 'h23',
});

function localParts(date: Date): LocalParts {
    const parts = new Map(
        formatter.formatToParts(date).map((part) => [part.type, part.value] as const),
    );

    const weekdayIndex = ISO_WEEKDAYS.indexOf(
        (parts.get('weekday') ?? '') as (typeof ISO_WEEKDAYS)[number],
    );
    if (weekdayIndex === -1) {
        throw new Error(`Could not read a weekday out of ${date.toISOString()}.`);
    }

    const read = (type: Intl.DateTimeFormatPartTypes): number => {
        const value = Number(parts.get(type));
        if (!Number.isFinite(value)) {
            throw new Error(`Could not read "${type}" out of ${date.toISOString()}.`);
        }
        return value;
    };

    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute'),
        weekday: weekdayIndex + 1,
    };
}

/**
 * The ISO year-week containing `date` in `DUTY_TIMEZONE`, e.g. `2026-W34`.
 *
 * Used as the rotation's idempotency key: one advance per duty week, whether it was posted by the
 * Monday cron or by the startup catch-up. Note the ISO year can differ from the calendar year in
 * the days around New Year — that is the point of using it rather than `year + week`.
 */
export function dutyWeekKey(date: Date): string {
    const { year, month, day } = localParts(date);

    // Shift to the Thursday of this week: the ISO year is whichever year that Thursday lands in.
    const thursday = new Date(Date.UTC(year, month - 1, day));
    const weekday = thursday.getUTCDay() || 7;
    thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);

    const isoYear = thursday.getUTCFullYear();
    const yearStart = Date.UTC(isoYear, 0, 1);
    const week = Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7);

    return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * Whether `date` is at or past this ISO week's scheduled announcement (Monday 07:40 Prague).
 *
 * Guards the startup catch-up: without it, a bot started early on Monday morning would post the
 * week's announcement hours before it is due.
 */
export function isPastWeeklyFireTime(date: Date): boolean {
    const { weekday, hour, minute } = localParts(date);
    // Tuesday through Sunday — the ISO week runs Mon–Sun, so the whole rest of it is past due.
    if (weekday > WEEKLY_DUTY_WEEKDAY) return true;
    return hour * 60 + minute >= WEEKLY_DUTY_HOUR * 60 + WEEKLY_DUTY_MINUTE;
}

/**
 * Whether this ISO week's announcement is due and has not been posted yet.
 *
 * The single condition behind both the daily schedule and the startup check, which is what makes
 * the two safe to run as often as they like: the first one to see a new week posts it, and every
 * later caller sees `lastCompletedWeek` already matching and does nothing.
 */
export function isWeeklyDutyDue(date: Date, lastCompletedWeek: string | null): boolean {
    if (!isPastWeeklyFireTime(date)) return false;
    return lastCompletedWeek !== dutyWeekKey(date);
}
