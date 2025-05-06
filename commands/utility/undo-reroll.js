const { SlashCommandBuilder, MessageFlags, InteractionContextType} = require('discord.js');
const { getDutyList, undoRerollDuty, getStringList } = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('undo-reroll')
        .setDescription('Vrátí poslední přeskočení člověka')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Důvod pro undo reroll')
                .setRequired(true)),

    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('972537907732684880');
        let dutyList = rerollDuty(getDutyList());
        const reason = interaction.options.getString('reason');

        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
-# Službu un-přesločil <@${interaction.user.id}> pomocí příkazu. Člověk, který byl přeskočen, bude mít službu tento týden.
-# Důvod: \`${reason}\``);
        await interaction.reply({ content: `Služba byla un-přeskočena.
Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
