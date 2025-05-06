const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { getDutyList } = require('../../utils/duty.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Oznámí, kdo má tento týden službu.')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('972537907732684880');
        let dutyList = getDutyList();

        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!`);
        await interaction.reply({ content: `<@${dutyList[0]}> má tento týden službu!`, flags: MessageFlags.Ephemeral });
    },
};