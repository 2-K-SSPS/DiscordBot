import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { getCurrentDuty, getStringList, undoRerollDuty } from '../../utils/duty.ts';
import { DUTY_FAILURE_MESSAGES } from '../../utils/replies.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('undo-reroll')
        .setDescription('Vrátí poslední přeskočení člověka')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) =>
            option.setName('reason').setDescription('Důvod pro undo reroll').setRequired(true),
        ),

    async execute(interaction) {
        const result = undoRerollDuty();
        if (!result.changed) {
            await interaction.reply({
                content: DUTY_FAILURE_MESSAGES[result.reason ?? 'nothing-to-undo'],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const reason = interaction.options.getString('reason', true);
        // Posted to the channel like every other mutation: the reroll announced someone who is no
        // longer on duty, so leaving the correction unposted would strand a wrong message there.
        const dutyChannel = await getSendableChannel(interaction.client, config.commandDutyChannelId);

        await dutyChannel.send(`<@${getCurrentDuty(result.list)}> má tento týden službu!
-# Přeskočení vrátil <@${interaction.user.id}> pomocí příkazu.
-# Důvod: \`${reason}\``);
        await interaction.reply({
            content: `Služba byla un-přeskočena.
Nový pořadník: ${getStringList(result.list)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
