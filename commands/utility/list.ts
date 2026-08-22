import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getDutyList, getStringList } from '../../utils/duty.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Zobrazí pořadník služby.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await interaction.reply({
            content: `Pořadník: ${getStringList(getDutyList())}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
