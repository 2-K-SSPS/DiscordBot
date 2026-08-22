import {
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { addToDuty, getStringList } from '../../utils/duty.ts';
import { MemberIntentError, collectRoleMemberIds } from '../../utils/members.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Přidá člověka nebo všechny členy role na konec pořadníku služby.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption((option) =>
            option.setName('user').setDescription('Člověk, kterého přidat').setRequired(false),
        )
        .addRoleOption((option) =>
            option
                .setName('role')
                .setDescription('Role — přidá všechny její členy')
                .setRequired(false),
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');

        if (user === null && role === null) {
            await interaction.reply({
                content: 'Zadej alespoň jednoho člověka (`user`) nebo roli (`role`).',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Listing a guild's members can take several requests, which outruns the 3s reply window.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ids: string[] = [];
        const notes: string[] = [];

        if (user !== null) {
            if (user.bot) notes.push(`<@${user.id}> je bot — přeskočen.`);
            else ids.push(user.id);
        }

        if (role !== null) {
            if (interaction.guild === null) {
                await interaction.editReply('Roli lze přidat jen na serveru.');
                return;
            }
            try {
                ids.push(...(await collectRoleMemberIds(interaction.guild, role.id)));
            } catch (error) {
                if (error instanceof MemberIntentError) {
                    await interaction.editReply(error.message);
                    return;
                }
                throw error;
            }
        }

        const result = addToDuty(ids);

        const lines: string[] = [];
        if (result.added.length === 0) {
            lines.push('Nikdo nebyl přidán.');
        } else {
            lines.push(
                `Přidáno do pořadníku: **${result.added.length}**`,
                result.added.map((id) => `<@${id}>`).join(' '),
            );
        }
        if (result.skipped.length > 0) {
            lines.push(`-# Už v pořadníku, přeskočeno: ${result.skipped.length}`);
        }
        lines.push(...notes.map((note) => `-# ${note}`));
        if (result.list.length > 0) lines.push(`Pořadník: ${getStringList(result.list)}`);

        await interaction.editReply(lines.join('\n'));
    },
};

export default command;
