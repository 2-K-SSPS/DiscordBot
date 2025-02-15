const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getDutyList, repeatDuty, getStringList} = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('repeat')
        .setDescription('Umístí člověka který měl naposledy službu na začátek pořadníku.'),
    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('972537907732684880');
        let dutyList = repeatDuty(getDutyList());
        // TODO: požadovat důvod změny pomocí modalu
        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
        -# Službu zopakoval <@${interaction.user.id}> pomocí příkazu.`);
        await interaction.reply({ content: `Služba byla přeskočena.
        Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
