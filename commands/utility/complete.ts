import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { completeDuty, getCurrentDuty, getStringList } from '../../utils/duty.ts';
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
        const dutyChannel = await getSendableChannel(interaction.client, config.commandDutyChannelId);
        const dutyList = completeDuty();
        const reason = interaction.options.getString('reason', true);

        await dutyChannel.send(`<@${getCurrentDuty(dutyList)}> má tento týden službu!
-# Službu manuálně dokončil <@${interaction.user.id}> pomocí příkazu.
-# Důvod: \`${reason}\``);
        await interaction.reply({
            content: `Služba byla dokončena.
Nový pořadník: ${getStringList(dutyList)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
