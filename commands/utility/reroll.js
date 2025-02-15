const { SlashCommandBuilder, MessageFlags, InteractionContextType} = require('discord.js');
const { getDutyList, rerollDuty, getStringList } = require('../../utils/duty.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('Přeskočí člověka, který má právě službu. Bude mít službu další týden.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Důvod pro forced dokončení')
                .setRequired(true)),

    async execute(interaction) {
        let dutyChannel = interaction.client.channels.cache.get('972537907732684880');
        let dutyList = rerollDuty(getDutyList());
        const reason = interaction.options.getString('reason');

        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
-# Službu přesločil <@${interaction.user.id}> pomocí příkazu. Přeskočený člověk bude mít službu příští týden.
-# Důvod: \`${reason}\``);
        await interaction.reply({ content: `Služba byla přeskočena.
Nový pořadník: ${getStringList(dutyList)}`, flags: MessageFlags.Ephemeral });
    },
};
