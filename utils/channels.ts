import type { Client, SendableChannels } from 'discord.js';

/**
 * Resolve a cached channel and narrow it to one messages can be sent to.
 *
 * Throws instead of failing silently: the original JavaScript called `.send()`
 * straight on a possibly-`undefined` cache hit, which surfaced as an opaque
 * `TypeError` inside the cron callback.
 */
export function getSendableChannel(client: Client, channelId: string): SendableChannels {
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
        throw new Error(`Channel ${channelId} is not in the cache.`);
    }
    if (!channel.isSendable()) {
        throw new Error(`Channel ${channelId} cannot be sent to.`);
    }

    return channel;
}
