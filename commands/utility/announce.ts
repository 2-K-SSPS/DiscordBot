import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { getCurrentDuty, getDutyList } from '../../utils/duty.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Oznámí, kdo má tento týden službu.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const dutyChannel = await getSendableChannel(interaction.client, config.commandDutyChannelId);
        const current = getCurrentDuty(getDutyList());

        await dutyChannel.send(`<@${current}> má tento týden službu!`);
        await interaction.reply({
            content: `<@${current}> má tento týden službu!`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
