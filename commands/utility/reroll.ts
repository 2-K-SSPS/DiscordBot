import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { getCurrentDuty, getStringList, rerollDuty } from '../../utils/duty.ts';
import { DUTY_FAILURE_MESSAGES } from '../../utils/replies.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('Přeskočí člověka, který má právě službu. Bude mít službu další týden.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) =>
            option.setName('reason').setDescription('Důvod pro reroll').setRequired(true),
        ),

    async execute(interaction) {
        const result = rerollDuty();
        if (!result.changed) {
            await interaction.reply({
                content: DUTY_FAILURE_MESSAGES[result.reason ?? 'empty-order'],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const reason = interaction.options.getString('reason', true);
        const dutyChannel = await getSendableChannel(interaction.client, config.commandDutyChannelId);

        await dutyChannel.send(`<@${getCurrentDuty(result.list)}> má tento týden službu!
-# Službu přeskočil <@${interaction.user.id}> pomocí příkazu. Přeskočený člověk bude mít službu příští týden.
-# Důvod: \`${reason}\``);
        await interaction.reply({
            content: `Služba byla přeskočena.
Nový pořadník: ${getStringList(result.list)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
