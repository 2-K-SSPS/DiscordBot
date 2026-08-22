import { ActivityType, Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { config } from './config.ts';
import { getSendableChannel } from './utils/channels.ts';
import { loadCommands } from './utils/commands.ts';
import { completeDuty, getCurrentDuty, getDutyList } from './utils/duty.ts';

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

    cron.schedule('40 7 * * 1', async () => {
        try {
            const dutyChannel = getSendableChannel(readyClient, config.cronDutyChannelId);
            const dutyList = completeDuty(getDutyList());
            await dutyChannel.send(`<@${getCurrentDuty(dutyList)}> má tento týden službu!
-# Pokud není ve škole, použij \`/reroll\``);
        } catch (error) {
            console.error('Failed to post the weekly duty announcement:', error);
        }
    });

    cron.schedule('*/30 * * * *', () => {
        const statusLines = buildStatusLines();
        const line = statusLines[Math.floor(Math.random() * statusLines.length)];
        if (line === undefined) return;
        readyClient.user.setActivity(line, { type: ActivityType.Custom });
    }).execute();
});

await client.login(config.token);
