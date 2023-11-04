// register discord.js slash commands
const { REST, Routes } = require('discord.js');
require('dotenv').config();
const rest = new REST().setToken(process.env.TOKEN);
const commands = [
     {
       name: 'new',
       description: 'Compose a new email',
      }
   ];
   const data = rest.put(
			Routes.applicationCommands(process.env.client),
			{ body: commands },
		);