import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getDutyList, getStringList } from '../../utils/duty.ts';
import { DUTY_FAILURE_MESSAGES } from '../../utils/replies.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Zobrazí pořadník služby.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const list = getDutyList();
        await interaction.reply({
            content:
                list.length === 0
                    ? DUTY_FAILURE_MESSAGES['empty-order']
                    : `Pořadník: ${getStringList(list)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
