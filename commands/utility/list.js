const { SlashCommandBuilder, MessageFlags, InteractionContextType} = require('discord.js');
const { getDutyList, getStringList} = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Zobrazí pořadník služby.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await interaction.reply({ content: `Pořadník: ${getStringList(getDutyList())}`, flags: MessageFlags.Ephemeral });
    },
};
