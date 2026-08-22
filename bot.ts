import { ActivityType, Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { DUTY_CHECK_CRON, DUTY_TIMEZONE } from './constants.ts';
import { config } from './config.ts';
import { getSendableChannel } from './utils/channels.ts';
import { loadCommands } from './utils/commands.ts';
import { completeDuty, getCurrentDuty, getLastCompletedWeek } from './utils/duty.ts';
import { dutyWeekKey, isWeeklyDutyDue } from './utils/week.ts';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
for (const command of await loadCommands()) {
    // Key the Collection by command name so interactions can be dispatched by name
    client.commands.set(command.data.name, command);
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const errorReply = {
            content: 'There was an error while executing this command!',
            flags: MessageFlags.Ephemeral,
        } as const;

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorReply);
        } else {
            await interaction.reply(errorReply);
        }
    }
});

/**
 * Advances the rotation for `weekKey` and announces the result.
 *
 * Shared by the Monday cron and the startup catch-up so the two can never drift apart. Recording
 * the week is part of `completeDuty`'s transaction, so a crash between rotating and announcing
 * cannot leave the week marked done without the rotation having happened.
 */
async function runWeeklyDuty(client: Client, weekKey: string): Promise<void> {
    const result = completeDuty(weekKey);
    if (!result.changed) {
        console.warn(`Skipped the weekly duty rotation for ${weekKey}: the duty order is empty.`);
        return;
    }

    const dutyChannel = await getSendableChannel(client, config.cronDutyChannelId);
    await dutyChannel.send(`<@${getCurrentDuty(result.list)}> má tento týden službu!
-# Pokud není ve škole, použij \`/reroll\``);
}

/**
 * Posts the week's announcement, if this week's is due and nothing has posted it yet.
 *
 * Safe to call as often as you like — the `last_completed_week` guard makes it a no-op once the
 * week has been announced. Advances the rotation at most **once** however many weeks were missed:
 * rotating once per missed week would burn through the order and rob everyone of their turn.
 */
async function announceWeeklyDutyIfDue(client: Client, trigger: string): Promise<void> {
    const now = new Date();
    if (!isWeeklyDutyDue(now, getLastCompletedWeek())) return;

    const weekKey = dutyWeekKey(now);
    console.log(`Posting the duty announcement for ${weekKey} (${trigger}).`);
    await runWeeklyDuty(client, weekKey);
}

/** Rotating "custom status" lines, one picked at random every 30 minutes. */
function buildStatusLines(): string[] {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(2025, 9, 4);
    const secondDate = new Date();

    const diffDays = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay));

    return [
        'Zkoumá ticho ve třídě',
        'Nechává problémy uležet',
        'Neví že je předsedou',
        'Je stále mrtev',
        '„Absence není argument“',
        `Do výuky nechodí již ${diffDays} dnů`,
        'Je reprezentativně absentní',
        'Dnes je přítomen jen duševně',
        'Zdraví z Těšína a volí se',
    ];
}

// listen for the client to be ready
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    cron.schedule(
        DUTY_CHECK_CRON,
        async () => {
            try {
                await announceWeeklyDutyIfDue(readyClient, 'scheduled');
            } catch (error) {
                console.error('Failed to post the weekly duty announcement:', error);
            }
        },
        // Without an explicit timezone this follows the host clock, which is UTC in the container —
        // the announcement would land at 09:40 Prague in summer and 08:40 in winter.
        { timezone: DUTY_TIMEZONE, noOverlap: true },
    );

    // Covers a bot that was offline across the scheduled tick entirely.
    void announceWeeklyDutyIfDue(readyClient, 'startup').catch((error: unknown) => {
        console.error('Failed to post the catch-up duty announcement:', error);
    });

    cron.schedule('*/30 * * * *', () => {
        const statusLines = buildStatusLines();
        const line = statusLines[Math.floor(Math.random() * statusLines.length)];
        if (line === undefined) return;
        readyClient.user.setActivity(line, { type: ActivityType.Custom });
    }).execute();
});

await client.login(config.token);
