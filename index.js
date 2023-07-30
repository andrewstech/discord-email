const Discord = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const JSONdb = require('simple-json-db');
const db = new JSONdb('emails.json');
const replydb = new JSONdb('replies.json');
const sgMail = require('@sendgrid/mail')
require('dotenv').config()
sgMail.setApiKey(process.env.SENDGRID_API_KEY)
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ActivityType } = require("discord.js");
const { ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');


const axios = require('axios');
const multer = require('multer');
const e = require('express');
const upload = multer();

const app = express();
const PORT = process.env.PORT || 3000;

const bot = new Client({ intents: [GatewayIntentBits.Guilds] });
bot.login(process.env.DISCORD);
const emailRegex = /[\w\.-]+@[\w\.-]+\.[\w\.-]+/;

app.use(bodyParser.json());

// Discord Channel ID where the bot will send messages
const channelID = '1134982019345035354';

app.post('/sendgrid-webhook', upload.none(), async (req, res) => {
  const emailData = req.body;
  // generate a unique id for the email if one doesn't exist
 //generate a unique 8 digit id
// get the current time
    let time = new Date();
    console.log(time);
    // if id already exists, check if it's a 
  // Process the incoming email data as needed
  console.log(emailData);
  let filteredEmails = emailData.from.match(emailRegex);
  // remove from array
    filteredEmails = filteredEmails[0];
    let email_id = filteredEmails

  // Create a Discord message with a reply button
  const message = `**New Email Received**\nFrom: ${filteredEmails}\nSubject: ${
    emailData.subject
  }\n\n${emailData.text}`;
  const reply = new ButtonBuilder()
            .setCustomId(email_id)
            .setLabel("Reply")
            .setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder()
        .addComponents(reply);
db.set(email_id, {from: filteredEmails, subject: emailData.subject, text: emailData.text, time: time});      
  try {
    const channel = await bot.channels.fetch(channelID);
    if (channel) {
      await channel.send({
        content: message,
        components: [row],
      });
      console.log('Email forwarded to Discord successfully.');
    } else {
      console.error('Channel not found or not a text channel.');
    }
  } catch (error) {
    console.error('Error forwarding email to Discord:', error);
  }

  res.sendStatus(200);
});

bot.on('interactionCreate', async (interaction) => {
  if (!interaction) return;

  // Check if the button click is from the reply button
  if (db.has(interaction.customId)) {
    console.log(interaction.customId)
    // You can handle the reply functionality here, e.g., open a modal or collect the reply text
    const userId = interaction.user.id;
    const emaild = db.get(interaction.customId);
    console.log(emaild)
    const subject = emaild.subject;
    const time = interaction.createdAt;
    replydb.set('r' + interaction.customId, {to: emaild.from, subject: emaild.subject, time: time, ID: interaction.customId});
    let modal = new ModalBuilder().setCustomId('r'+ interaction.customId).setTitle('RE: ' + subject);
    console.log(`User ${userId} clicked the reply button.`);
    const message = new TextInputBuilder()
            .setCustomId("message")
            .setLabel("What's the message?")
            // Paragraph means multiple lines of text.
            .setStyle(TextInputStyle.Paragraph);
    const thirdActionRow = new ActionRowBuilder().addComponents(message);
    modal.addComponents(thirdActionRow);
    await interaction.showModal(modal);
    // Implement your reply functionality here, such as sending a DM to the user or taking any other action.
  }
  if (replydb.has(interaction.customId)) {
    let message = interaction.fields.getTextInputValue('message');
        const confirm = new ButtonBuilder().setCustomId("confirm").setLabel("Confirm Send").setStyle(ButtonStyle.Danger);

        const cancel = new ButtonBuilder().setCustomId("cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(cancel, confirm);

        //await User.findOneAndDelete({ userid: interaction.user.id });
        const response = await interaction.reply({
            content: `Are you sure you want to send the following reply? \n\n${message}`,
            components: [row],
            ephemeral: false,
        });

        const collectorFilter = (i) => i.user.id === interaction.user.id;

        try {
            const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 600000 });
            if (confirmation.customId === "confirm") {
                let to = replydb.get(interaction.customId).to;
                let subject = replydb.get(interaction.customId).subject;
                let ID = replydb.get(interaction.customId).ID;
                let original = db.get(ID).text;
                let time = db.get(ID).time;
                let reply = message;
                let response = message + '\n\n' + '--Received at ' + time + '--' + '\n\n' + original
    
                
                const msg = {
                    to: to, // Change to your recipient
                    from: 'hello@maintainers.is-a.dev', // Change to your verified sender
                    subject: 'RE:' + subject,
                    text: response,
                    headers: {
                        "List-Unsubscribe": `<mailto:unsub@maintainers.is-a.dev?subject=Unsubscribe&body=Unsubscribe%20me%20from%20all%20emails%20from%20is-a.dev%20please.>`
                    }    
                }
                sgMail
                .send(msg)
                .then(async (response) => {
                    console.log(response[0].statusCode)
                    console.log(response[0].headers)
                    await confirmation.update({ content: `The following has been sent  \n\n${message}`, components: [] });
                })
                .catch(async (error) => {
                    console.error(error)
                    await interaction.reply({ content: "Email failed to send!" });
                })
            } else if (confirmation.customId === "cancel") {
                await confirmation.update({ content: "Action cancelled", components: [] });
            }
        } catch (e) {
            console.log(e);
            await interaction.editReply({ content: "Confirmation not received within 1 minute, cancelling", components: [] });
            return;
        }
    // Implement your reply functionality here, such as sending a DM to the user or taking any other action.
  }

});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
