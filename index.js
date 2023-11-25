const Discord = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const { Client, GatewayIntentBits, ButtonStyle } = require("discord.js");
const { ButtonBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');

const upload = multer();
const maxMessageLength = 2000;
const emailRegex = /[\w\.-]+@[\w\.-]+\.[\w\.-]+/;
const app = express();
const PORT = process.env.PORT || 3000;
const htmlFileFolder = './email_htmls';
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const EmailModel = mongoose.model('Email', new mongoose.Schema({
  emailId: String,
  from: String,
  subject: String,
  text: String,
  time: Date,
  accessKey: String,
}));

const ReplyModel = mongoose.model('Reply', new mongoose.Schema({
  to: String,
  subject: String,
  time: Date,
  emailId: String,
  accessKey: String,
}));

const bot = new Client({ intents: [GatewayIntentBits.Guilds] });
bot.login(process.env.DISCORD);

app.use(bodyParser.json());

function generateUnique8DigitId() {
  // Generate a random number between 10000000 and 99999999 inclusive.
  const randomNumber = Math.floor(Math.random() * (99999999 - 10000000 + 1)) + 10000000;
  // Convert the random number to a string.
  let idString = randomNumber.toString();
  // Add leading zeroes to the string until it is 8 digits long.
  while (idString.length < 8) {
    idString = `0${idString}`;
  }
  // Return the unique 8 digit ID.
  return idString;
}

const channelID = '1134982019345035354';

app.get('/', (req, res) => {
  res.send('Hello I am alive!');
});



app.get('/bigBalls', (req, res) => {
  res.send('You atached big balls to the end of the url, you are a legend :D');
});

app.post('/sendgrid-webhook', upload.any(), async (req, res) => {
  const emailData = req.body;
  let time = new Date();
  console.log(time);
  let filteredEmails = emailData.from.match(emailRegex);
  filteredEmails = filteredEmails[0];
  filteredEmails = filteredEmails.toString();
  let email_id = generateUnique8DigitId();
  let accessKey = generateUnique8DigitId();

  
  let dataToSave = emailData.html;
  let viewID = email_id;
  let filePath = `${htmlFileFolder}/${viewID}.html`;
  const message = `**New Email Received**\nFrom: ${filteredEmails}\nSubject: ${emailData.subject}\n\n${emailData.text}`;

  fs.writeFile(filePath, dataToSave, (err) => {
    if (err) {
      console.error('Error writing to file:', err);
    } else {
      console.log('Data saved to file successfully.');
    }
  });

  const reply = new ButtonBuilder()
    .setCustomId('reply_' + email_id)
    .setLabel("Reply")
    .setStyle(ButtonStyle.Secondary);
  const view = new ButtonBuilder()
    .setLabel("View HTML")
    .setStyle(ButtonStyle.Link)
    .setURL(`https://${process.env.ENDPOINT}/view/${viewID}?accessKey=${accessKey}`);
  const row = new ActionRowBuilder()
    .addComponents(reply, view);

  try {
    const channel = await bot.channels.fetch(channelID);
    if (channel) {
      if (message.length >= maxMessageLength) {
        const errorEmbed = new EmbedBuilder()
          .setTitle(emailData.subject)
          .setAuthor({name: filteredEmails})
          .setDescription('The email was too long to be sent to Discord.');
        await channel.send({
          embeds: [errorEmbed],
          components: [row],
        });
      } else {
        const messageEmbed = new EmbedBuilder()
          .setTitle(emailData.subject)
          .setAuthor({name: filteredEmails})
          .setDescription(emailData.text);
        await channel.send({
          embeds: [messageEmbed],
          components: [row],
        });
      }
      console.log('Email forwarded to Discord successfully.');
    } else {
      console.error('Channel not found or not a text channel.');
    }
  } catch (error) {
    console.error('Error forwarding email to Discord:', error);
  }

  const newEmail = new EmailModel({
    emailId: email_id,
    from: filteredEmails,
    subject: emailData.subject,
    text: emailData.text,
    time: time,
    accessKey: accessKey,
  });

  newEmail.save()
    .then(() => {
      console.log('Email data saved to MongoDB successfully.');
    })
    .catch((error) => {
      console.error('Error saving email data to MongoDB:', error);
    });

  res.sendStatus(200);
});

app.get('/view/:email_id', async (req, res) => {
  const { email_id } = req.params;
  const { accessKey } = req.query;

  EmailModel.findOne({ emailId: email_id, accessKey: accessKey })
    .then((email) => {
      if (email) {
        let filePath = `${htmlFileFolder}/${email_id}.html`;
        res.sendFile(filePath, { root: __dirname });
      } else {
        res.status(404).send('Not found');
      }
    })
    .catch((error) => {
      console.error('Error retrieving email from MongoDB:', error);
      res.status(500).send('Internal Server Error');
    });
});

bot.on('interactionCreate', async (interaction) => {
  // if not button or modal, ignore
  if (!interaction.isButton() && !interaction.isModalSubmit) return;  

  // Check if the button click is from the reply button
  if (interaction.customId.startsWith('reply_')) {
    const emailId = interaction.customId.substring(6);
    const userId = interaction.user.id;
    const emailData = await EmailModel.findOne({ emailId });

    if (emailData) {
      const subject = emailData.subject;
      const time = new Date();
      const replyAccessKey = generateUnique8DigitId();

      // Store the reply information in the database
      const replyData = new ReplyModel({
        to: emailData.from,
        subject: emailData.subject,
        time,
        emailId,
        accessKey: replyAccessKey,
      });

      replyData.save().then(() => {
        console.log(`Stored reply data for user ${userId}`);
      }).catch((error) => {
        console.error('Error storing reply data:', error);
      });

      // Create a modal for composing the reply
      const modal = new ModalBuilder()
        .setCustomId(`compose_${emailId}`)
        .setTitle(`RE: ${subject}`);

      const message = new TextInputBuilder()
        .setCustomId("message")
        .setLabel("What's the message?")
        .setStyle(TextInputStyle.Paragraph);

      const thirdActionRow = new ActionRowBuilder().addComponents(message);
      modal.addComponents(thirdActionRow);

      await interaction.showModal(modal);
    }
  }

  if (interaction.customId.startsWith('compose_')) {
    const emailId = interaction.customId.substring(8);
    const message = interaction.fields.getTextInputValue('message');
    console.log("Replying to email " + emailId + " with message: " + message)

    // Implement your reply functionality here, such as sending an email and handling confirmation
    const emailData = await EmailModel.findOne({ emailId });
    const replyData = await ReplyModel.findOne({ emailId });

    if (emailData && replyData) {
      const to = emailData.from;
      const subject = emailData.subject;
      const original = emailData.text;
      const time = emailData.time;
      const reply = message;
      const response = `${message}\n\n--Received at ${time}--\n\n${original}`;

      const post = {
        "598245488977903688": "andrew@maintainers.is-a.dev",
        "853158265466257448": "william@maintainers.is-a.dev",
        "757296951925538856": "dibster@maintainers.is-a.dev",
        "914452175839723550": "vaibhav@maintainers.is-a.dev"
      };

      let from = post[interaction.user.id] || "hello@maintainers.is-a.dev";

      const msg = {
        to, // Change to your recipient
        from, // Change to your verified sender
        subject: `RE: ${subject}`,
        text: response,
        headers: {
          "List-Unsubscribe": `<mailto:unsub@maintainers.is-a.dev?subject=Unsubscribe&body=Unsubscribe%20me%20from%20all%20emails%20from%20is-a.dev%20please.>`
        }
      };

      sgMail.send(msg)
        .then(async (response) => {
          console.log(response[0].statusCode);
          console.log(response[0].headers);
          await interaction.reply({ content: `The following has been sent\n\n${message}`, ephemeral: false });
        })
        .catch(async (error) => {
          console.error(error);
          await interaction.reply({ content: "Email failed to send!", ephemeral: false });
        });
      return;  
    }
    await interaction.reply({ content: "Email failed to send!", ephemeral: false });
  }

});


app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
