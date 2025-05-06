const { SlashCommandBuilder, MessageFlags, InteractionContextType} = require('discord.js');
const { getDutyList, completeDuty, getStringList} = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('complete')
        .setDescription('Forced dokončení služby. Přeskočený člověk je umístěn na konec pořadníku.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Důvod pro forced dokončení')
                .setRequired(true)),

    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('1283009850997215277');
        let dutyList = completeDuty(getDutyList());
        const reason = interaction.options.getString('reason');

        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
-# Službu manuálně dokončil <@${interaction.user.id}> pomocí příkazu.
-# Důvod: \`${reason}\``);
        await interaction.reply({ content: `Služba byla dokončena.
Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
