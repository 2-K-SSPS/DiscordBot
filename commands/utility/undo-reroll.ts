import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getStringList, undoRerollDuty } from '../../utils/duty.ts';
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
        const dutyList = undoRerollDuty();

        await interaction.reply({
            content: `Služba byla un-přeskočena.
Nový pořadník: ${getStringList(dutyList)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
