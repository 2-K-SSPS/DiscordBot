import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.ts';
import { getSendableChannel } from '../../utils/channels.ts';
import { getDutyList } from '../../utils/duty.ts';
import { DUTY_FAILURE_MESSAGES } from '../../utils/replies.ts';
import type { Command } from '../../types.ts';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Oznámí, kdo má tento týden službu.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const current = getDutyList()[0];
        if (current === undefined) {
            await interaction.reply({
                content: DUTY_FAILURE_MESSAGES['empty-order'],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const dutyChannel = await getSendableChannel(interaction.client, config.commandDutyChannelId);
        await dutyChannel.send(`<@${current}> má tento týden službu!`);
        await interaction.reply({
            content: `<@${current}> má tento týden službu!`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;
