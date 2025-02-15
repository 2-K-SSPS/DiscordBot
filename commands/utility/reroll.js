const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getDutyList, rerollDuty, getStringList } = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('Přeskočí člověka, který má právě službu. Bude mít službu další týden.'),
    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('972537907732684880');
        let dutyList = rerollDuty(getDutyList());
        // TODO: požadovat důvod změny pomocí modalu
        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!\n-# Službu přeskočil <@${interaction.user.id}> pomocí příkazu. Přeskočený člověk bude mít službu další týden.`);
        await interaction.reply({ content: `Služba byla přeskočena. Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
