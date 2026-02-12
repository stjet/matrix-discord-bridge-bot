import { writeFileSync, readFileSync } from "fs";

import { PermissionsBitField, Message } from "discord.js";

let BANLIST = JSON.parse(readFileSync("./banlist.json", "utf-8"));

export function get_banlist(): Record<string, boolean> {
  return BANLIST;
}

export async function handle_command(message: Message, parts: string[]) {
  const command = parts.shift();
  if (!message.member?.permissionsIn(message.channel.id).has(PermissionsBitField.Flags.ManageMessages)) return;
  switch (command) {
    case "ban":
      //probably do regex
      if (!parts[0].startsWith("@") || !parts[0].includes(".") || !parts[0].includes(":")) return;
      if (BANLIST[parts[0].toLowerCase()]) return await message.reply(`${parts[0]} already in banlist`);
      BANLIST[parts[0].toLowerCase()] = true;
      writeFileSync("banlist.json", JSON.stringify(BANLIST, undefined, 2));
      return await message.reply(`${parts[0]} added to banlist`);
    case "unban":
      //probably do regex
      if (!parts[0].startsWith("@") || !parts[0].includes(".") || !parts[0].includes(":")) return;
      delete BANLIST[parts[0].toLowerCase()];
      writeFileSync("banlist.json", JSON.stringify(BANLIST, undefined, 2));
      return await message.reply(`${parts[0]} removed from banlist`);
    default:
  }
}
