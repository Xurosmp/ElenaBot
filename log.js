import { guild } from '../db.js';
export async function logTo(client, gid, e) {
  const g = guild(gid);
  if (!g.logChannel) return;
  const ch = await client.channels.fetch(g.logChannel).catch(() => null);
  ch?.send({ embeds: [e] }).catch(() => {});
}
