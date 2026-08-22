/** Number of people shown by `getStringList` before it truncates with `...`. */
export const DUTY_LIST_PREVIEW_LENGTH = 6;

/** Timezone every duty schedule is expressed in — the school's local time. */
export const DUTY_TIMEZONE = 'Europe/Prague';

/**
 * When the duty announcement is due: Monday 07:40 in `DUTY_TIMEZONE`.
 *
 * The schedule below deliberately ticks *daily* rather than encoding the Monday in the cron
 * expression. The handler decides whether the week's announcement is actually due, which means a
 * Monday the bot slept through is recovered by Tuesday's tick instead of waiting for a restart.
 * `last_completed_week` makes the extra ticks idempotent.
 */
export const DUTY_CHECK_CRON = '40 7 * * *';
export const WEEKLY_DUTY_WEEKDAY = 1;
export const WEEKLY_DUTY_HOUR = 7;
export const WEEKLY_DUTY_MINUTE = 40;

/** Discord's hard cap on a message's content length. */
export const DISCORD_MESSAGE_LIMIT = 2000;
