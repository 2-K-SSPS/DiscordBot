import {
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { getDutyList, getFullList, getRerollState } from '../../utils/duty.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('roster')
        .setDescription('Zobrazí celý pořadník služby včetně stavu přeskočení.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const list = getDutyList();
        const { currentIndex, stackDepth } = getRerollState();

        const lines = [getFullList(list, currentIndex)];
        if (list.length > 0) {
            lines.push(
                '',
                `-# ▶ má službu · ↩ přeskočen tento týden · celkem ${list.length}`,
                `-# Přeskočení k vrácení: ${stackDepth}`,
            );
        }

        await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
    },
};

export default command;
