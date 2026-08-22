import type { DutyFailure } from './duty.ts';

/**
 * User-facing explanation for a mutation that did nothing.
 *
 * Kept out of `utils/duty.ts` so the storage layer stays free of presentation text.
 */
export const DUTY_FAILURE_MESSAGES: Record<DutyFailure, string> = {
    'empty-order': 'Pořadník je prázdný — nejdřív někoho přidej pomocí `/add`.',
    'no-reroll-target': 'Všichni v pořadníku už byli tento týden přeskočeni. Není koho dalšího nasadit.',
    'nothing-to-undo': 'Není co vracet — od poslední služby nikdo nebyl přeskočen.',
};
