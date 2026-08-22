import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import type { Guild } from 'discord.js';

/** Discord's maximum page size for `GET /guilds/{id}/members`. */
const MEMBER_PAGE_SIZE = 1000;

/**
 * Thrown when Discord refuses to list members because the privileged intent is off.
 *
 * Carries a user-facing message so the command can relay it verbatim rather than failing with the
 * generic error reply.
 */
export class MemberIntentError extends Error {
    constructor() {
        super(
            'Nelze načíst členy role — bot nemá oprávnění „Server Members Intent“.\n' +
                'Zapni ho v Discord Developer Portal → Bot → Privileged Gateway Intents → ' +
                '**Server Members Intent**, nebo přidávej lidi jednotlivě přes `user`.',
        );
        this.name = 'MemberIntentError';
    }
}

/**
 * Every non-bot member holding `roleId`, in Discord's own order.
 *
 * Uses `guild.members.list()`, which is plain REST (`GET /guilds/{id}/members`) rather than a
 * gateway member chunk request — so the bot never has to request the privileged `GuildMembers`
 * intent at login and can never be rejected with close code 4014. Discord still gates the endpoint
 * itself on that intent being enabled for the application, hence `MemberIntentError`.
 */
export async function collectRoleMemberIds(guild: Guild, roleId: string): Promise<string[]> {
    const ids: string[] = [];
    let after: string | undefined;

    for (;;) {
        let page;
        try {
            page = await guild.members.list({ limit: MEMBER_PAGE_SIZE, after, cache: false });
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                (error.code === RESTJSONErrorCodes.MissingAccess || error.status === 403)
            ) {
                throw new MemberIntentError();
            }
            throw error;
        }

        if (page.size === 0) break;

        for (const member of page.values()) {
            if (member.user.bot) continue;
            if (member.roles.cache.has(roleId)) ids.push(member.id);
        }

        if (page.size < MEMBER_PAGE_SIZE) break;
        after = page.lastKey();
    }

    return ids;
}
