import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { completeDuty, getCurrentDuty, getStringList } from '../../utils/duty.ts';
import { DUTY_FAILURE_MESSAGES } from '../../utils/replies.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('complete')
        .setDescription('Forced dokončení služby. Přeskočený člověk je umístěn na konec pořadníku.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Důvod pro forced dokončení')
                .setRequired(true),
        ),

    async execute(interaction) {
        const result = completeDuty();
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
-# Službu manuálně dokončil <@${interaction.user.id}> pomocí příkazu.
-# Důvod: \`${reason}\``);
        await interaction.reply({
            content: `Služba byla dokončena.
Nový pořadník: ${getStringList(result.list)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
