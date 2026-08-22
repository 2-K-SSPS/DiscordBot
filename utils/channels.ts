import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import type { Client, SendableChannels } from 'discord.js';

/**
 * Resolve a channel and narrow it to one messages can be sent to.
 *
 * Uses `fetch` rather than reading `client.channels.cache` directly, so it also works for
 * channels the cache never holds: threads (only active ones arrive at startup), and anything
 * requested before `GUILD_CREATE` has populated the cache.
 *
 * Throws instead of failing silently: the original JavaScript called `.send()` straight on a
 * possibly-`undefined` cache hit, which surfaced as an opaque `TypeError` inside the cron
 * callback. The two common misconfigurations are reported distinctly, because a bad id and a
 * missing permission are indistinguishable from an empty cache.
 */
export async function getSendableChannel(
    client: Client,
    channelId: string,
): Promise<SendableChannels> {
    let channel;
    try {
        channel = await client.channels.fetch(channelId);
    } catch (error) {
        if (error instanceof DiscordAPIError) {
            if (error.code === RESTJSONErrorCodes.UnknownChannel) {
                throw new Error(
                    `Channel ${channelId} does not exist. Check the id in config.json — it is easy to copy a category, role or guild id by mistake.`,
                );
            }
            if (error.code === RESTJSONErrorCodes.MissingAccess) {
                throw new Error(
                    `Channel ${channelId} exists but the bot cannot see it. Grant it the "View Channel" permission.`,
                );
            }
        }
        throw error;
    }

    if (channel === null) {
        throw new Error(`Channel ${channelId} could not be resolved.`);
    }
    if (!channel.isSendable()) {
        throw new Error(`Channel ${channelId} cannot be sent to.`);
    }

    return channel;
}
