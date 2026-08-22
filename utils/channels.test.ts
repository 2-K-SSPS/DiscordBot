import { describe, expect, test } from 'bun:test';
import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import type { Client } from 'discord.js';
import { getSendableChannel } from './channels.ts';

const CHANNEL_ID = '123456789012345678';

/** Minimal stand-in for the only part of `Client` this helper touches. */
function clientWith(fetch: () => Promise<unknown>): Client {
    return { channels: { fetch } } as unknown as Client;
}

function apiError(code: number, status: number): DiscordAPIError {
    return new DiscordAPIError({ message: 'x', code }, code, status, 'GET', 'https://x', {});
}

describe('getSendableChannel', () => {
    test('returns a sendable channel', async () => {
        const channel = { isSendable: () => true };
        const resolved = await getSendableChannel(
            clientWith(() => Promise.resolve(channel)),
            CHANNEL_ID,
        );
        expect(resolved).toBe(channel as never);
    });

    test('explains an unknown channel id', async () => {
        const client = clientWith(() =>
            Promise.reject(apiError(RESTJSONErrorCodes.UnknownChannel, 404)),
        );
        await expect(getSendableChannel(client, CHANNEL_ID)).rejects.toThrow('does not exist');
    });

    test('explains a missing View Channel permission', async () => {
        const client = clientWith(() =>
            Promise.reject(apiError(RESTJSONErrorCodes.MissingAccess, 403)),
        );
        await expect(getSendableChannel(client, CHANNEL_ID)).rejects.toThrow('View Channel');
    });

    test('rethrows unrelated API errors untouched', async () => {
        const error = apiError(RESTJSONErrorCodes.MaximumNumberOfGuildsReached, 400);
        await expect(getSendableChannel(clientWith(() => Promise.reject(error)), CHANNEL_ID)).rejects.toBe(
            error,
        );
    });

    test('rejects when the channel resolves to null', async () => {
        const client = clientWith(() => Promise.resolve(null));
        await expect(getSendableChannel(client, CHANNEL_ID)).rejects.toThrow('could not be resolved');
    });

    test('rejects a channel that cannot be sent to', async () => {
        const client = clientWith(() => Promise.resolve({ isSendable: () => false }));
        await expect(getSendableChannel(client, CHANNEL_ID)).rejects.toThrow('cannot be sent to');
    });
});
