import { appendFileSync, readFileSync } from "fs";

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
  if (!MAPPING[message.channelId] || message.author.id === discord_client.user.id || (message.webhookId && (await message.fetchWebhook()).name === "Matrix Bridge")) return;
  const channel_id = message.channelId;
  let attachments = "";
  for (const [_, a] of message.attachments) {
    attachments += "\n" + a.url;
  }
  await matrix_client.sendEvent(MAPPING[channel_id], matrix.EventType.RoomMessage, {
    msgtype: matrix.MsgType.Text,
    format: "org.matrix.custom.html",
    body: `${message.author.tag}: ${message.content}`,
    formatted_body: `<strong>${message.author.tag}:</strong> ${message.content}${attachments}`,
  });
});

//matrix

//authenticated media must be bypassed, see https://blog.kimiblock.top/2024/11/23/bypassing-auth-media/index.html
matrix_client.on(matrix.RoomEvent.Timeline, async (event, room) => {
  if (event.getType() !== "m.room.message") return;
  const { sender, content, room_id } = event.event;
  if (!MAPPING[room_id] || sender === process.env.MATRIX_USER) return;
  const channel_id = MAPPING[room_id];
  let webhook_id = process.env[`webhookid_${channel_id}`];
  let webhook_token = process.env[`webhooktoken_${channel_id}`];
  if (!webhook_id || !webhook_token) {
    console.log("Creating new webhook");
    const webhook = await (await discord_client.channels.fetch(MAPPING[room_id]) as discord.TextChannel).createWebhook({
      name: "Matrix Bridge",
    });
    webhook_id = webhook.id;
    process.env[`webhookid_${channel_id}`] = webhook_id;
    webhook_token = webhook.token;
    process.env[`webhooktoken_${channel_id}`] = webhook_token;
    appendFileSync(".env", `\nwebhookid_${channel_id}=${webhook_id}\nwebhooktoken_${channel_id}=${webhook_token}`);
  }
  const webhook_client = new discord.WebhookClient({ id: webhook_id, token: webhook_token });
  await webhook_client.send({
    content: content.body,
    username: sender,
    avatarURL: event.sender.getAvatarUrl(matrix_client.getHomeserverUrl(), 128, 128, "crop", true, false).replace("media/v3", "client/v1/media"),
  });
  //
  //await (await discord_client.channels.fetch(channel_id) as discord.TextChannel).send(`**${sender}:** ${content.body}`);
});

