import {
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { getStringList, removeFromDuty } from '../../utils/duty.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Odebere člověka z pořadníku služby.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption((option) =>
            option.setName('user').setDescription('Člověk, kterého odebrat').setRequired(true),
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user', true);
        const result = removeFromDuty(user.id);

        if (!result.removed) {
            await interaction.reply({
                content: `<@${user.id}> v pořadníku není.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lines = [`<@${user.id}> byl odebrán z pořadníku.`];
        if (result.wasOnDuty) {
            lines.push(
                result.list.length === 0
                    ? '-# Měl právě službu — pořadník je teď prázdný.'
                    : `-# Měl právě službu, takže ji teď přebírá <@${result.list[0]}>.`,
            );
        }
        if (result.list.length > 0) lines.push(`Nový pořadník: ${getStringList(result.list)}`);

        await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
    },
};

export default command;
