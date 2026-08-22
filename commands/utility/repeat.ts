import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { getCurrentDuty, getStringList, repeatDuty } from '../../utils/duty.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('repeat')
        .setDescription('Umístí člověka který měl naposledy službu na začátek pořadníku.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('Důvod pro opakování služby')
                .setRequired(true),
        ),

    async execute(interaction) {
        const dutyChannel = await getSendableChannel(interaction.client, config.commandDutyChannelId);
        const dutyList = repeatDuty();
        const reason = interaction.options.getString('reason', true);

        await dutyChannel.send(`<@${getCurrentDuty(dutyList)}> má tento týden službu!
-# Službu zopakoval <@${interaction.user.id}> pomocí příkazu.
-# Důvod: \`${reason}\``);
        await interaction.reply({
            content: `Služba byla zopakována.
Nový pořadník: ${getStringList(dutyList)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
