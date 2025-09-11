const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, ActivityType } = require('discord.js');
import cron from 'node-cron';
import {completeDuty, getDutyList} from "./utils/duty.js";
const { token } = require('./config.json');

const client = new Client({intents: [GatewayIntentBits.Guilds]});

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        }
    }
});

// listen for the client to be ready
client.once(Events.ClientReady, (c) => {
    let dutyChannel = c.channels.cache.get('972537907732684880');
    console.log(`Ready! Logged in as ${c.user.tag}`);
    
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(2025, 9, 4);
    const secondDate = new Date();

    const diffDays = Math.round(Math.abs((firstDate - secondDate) / oneDay));
    
    const hlasky = ["Zkoumá ticho ve třídě", "Nechává problémy uležet", "Neví že je předsedou", "Je stále mrtev", "„Absence není argument“", `Do výuky nechodí již ${diffDays} dnů`, "Je reprezentativně absentní", "Dnes je přítomen jen duševně", "Zdraví z Těšína a volí se"]

    cron.schedule('40 7 * * 1', () => {
        let dutyList = completeDuty(getDutyList());
        dutyChannel.send(`<@${dutyList[0]}> má tento týden službu!
-# Pokud není ve škole, použij \`/reroll\``);
    })
    
    cron.schedule('*/30 * * * *', () => {
        client.user.setActivity(hlasky[Math.floor(Math.random() * hlasky.length)], {type: ActivityType.Custom});
    }).execute()
});

client.login(token);