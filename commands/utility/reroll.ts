import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { getCurrentDuty, getDutyList, getStringList, rerollDuty } from '../../utils/duty.ts';
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
        const dutyChannel = getSendableChannel(interaction.client, config.commandDutyChannelId);
        const dutyList = rerollDuty(getDutyList());
        const reason = interaction.options.getString('reason', true);

        await dutyChannel.send(`<@${getCurrentDuty(dutyList)}> má tento týden službu!
-# Službu přesločil <@${interaction.user.id}> pomocí příkazu. Přeskočený člověk bude mít službu příští týden.
-# Důvod: \`${reason}\``);
        await interaction.reply({
            content: `Služba byla přeskočena.
Nový pořadník: ${getStringList(dutyList)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
