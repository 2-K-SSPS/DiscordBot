const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { getDutyList, repeatDuty, getStringList} = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('repeat')
        .setDescription('Umístí člověka který měl naposledy službu na začátek pořadníku.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Důvod pro opakování služby')
                .setRequired(true)),

    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('1283009850997215277');
        let dutyList = repeatDuty(getDutyList());
        const reason = interaction.options.getString('reason');

        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
-# Službu zopakoval <@${interaction.user.id}> pomocí příkazu.
-# Důvod: \`${reason}\``);
        await interaction.reply({ content: `Služba byla zopakována.
Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
