import { readFileSync } from "fs";

import * as discord from "discord.js";
import * as matrix from "matrix-js-sdk";
import { logger } from 'matrix-js-sdk/lib/logger.js';

logger.disableAll();

//setup

const MAPPING = JSON.parse(readFileSync("./mapping.json", "utf-8"));

const discord_client = new discord.Client({
  intents: [
    discord.GatewayIntentBits.Guilds,
    discord.GatewayIntentBits.GuildMessages,
    discord.GatewayIntentBits.MessageContent,
  ],
});

discord_client.login(process.env.DISCORD_TOKEN);

const matrix_client = matrix.createClient({
  baseUrl: process.env.MATRIX_HOMESERVER,
  accessToken: process.env.MATRIX_TOKEN,
  userId: process.env.MATRIX_USER,
});

matrix_client.startClient({ initialSyncLimit: 0 });

//discord

discord_client.on("messageCreate", async (message) => {
  if (!MAPPING[message.channelId] || message.author.id === discord_client.user.id) return;
  await matrix_client.sendEvent(MAPPING[message.channelId], matrix.EventType.RoomMessage, {
    msgtype: matrix.MsgType.Text,
    format: "org.matrix.custom.html",
    body: `${message.author.tag}: ${message.content}`,
    formatted_body: `<strong>${message.author.tag}:</strong> ${message.content}`,
  });
});

//matrix

matrix_client.on(matrix.RoomEvent.Timeline, async (event, room) => {
  if (event.getType() !== "m.room.message") return;
  const { sender, content, room_id } = event.event;
  if (!MAPPING[room_id] || sender === process.env.MATRIX_USER) return;
  await (await discord_client.channels.fetch(MAPPING[room_id]) as discord.TextChannel).send(`**${sender}:** ${content.body}`);
});

