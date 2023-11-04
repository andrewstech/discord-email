// register discord.js slash commands
const { REST, Routes } = require('discord.js');
require('dotenv').config();
const rest = new REST().setToken(process.env.TOKEN);
const commands = [
   ];
   const data = rest.put(
			Routes.applicationCommands(process.env.client),
			{ body: commands },
		);