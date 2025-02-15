const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getDutyList, completeDuty, getStringList} = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('complete')
        .setDescription('Přeskočí člověka, který má právě službu a umístí ho na konec pořadníku.'),
    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('972537907732684880');
        let dutyList = completeDuty(getDutyList());
        // TODO: požadovat důvod změny pomocí modalu
        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
        -# Službu přeskočil <@${interaction.user.id}> pomocí příkazu.`);
        await interaction.reply({ content: `Služba byla přeskočena.
        Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
