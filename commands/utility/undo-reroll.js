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
        let dutyList = rerollDuty(getDutyList());

        await interaction.reply({ content: `Služba byla un-přeskočena.
Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
