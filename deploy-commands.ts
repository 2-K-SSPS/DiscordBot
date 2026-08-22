import { REST, Routes } from 'discord.js';
import type { RESTPutAPIApplicationGuildCommandsResult } from 'discord.js';
import { config } from './config.ts';
import { loadCommands } from './utils/commands.ts';

// Grab the SharedSlashCommand#toJSON() output of each command for deployment
const commands = (await loadCommands()).map((command) => command.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.token);

// and deploy your commands!
try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = (await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
    })) as RESTPutAPIApplicationGuildCommandsResult;

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
    process.exitCode = 1;
}
