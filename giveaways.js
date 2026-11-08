import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { db, save } from '../db.js';

export const gwEmbed = (gw) =>
  new EmbedBuilder()
    .setColor(gw.ended ? 0x747f8d : 0xf1c40f)
    .setTitle(`🎉 ${gw.prize}`)
    .setDescription(gw.ended
      ? `Beendet • Gewinner: ${gw.winnerIds.length ? gw.winnerIds.map((x) => `<@${x}>`).join(', ') : 'niemand'}`
      : `Endet <t:${Math.floor(gw.end / 1000)}:R>\nGewinner: **${gw.winners}**\nKlicke unten, um teilzunehmen!`)
    .setFooter({ text: `${gw.entries.length} Teilnehmer` });

export async function startGiveaway(i, prize, minutes, winners) {
  const gw = { prize, end: Date.now() + minutes * 60000, winners, entries: [], ended: false, winnerIds: [], channelId: i.channelId };
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gw:join').setLabel('Teilnehmen').setEmoji('🎉').setStyle(ButtonStyle.Primary));
  const msg = await i.channel.send({ embeds: [gwEmbed(gw)], components: [row] });
  db.giveaways[msg.id] = gw;
  save();
}

export async function endGiveaway(client, id) {
  const gw = db.giveaways[id];
  if (!gw || gw.ended) return;
  gw.ended = true;
  const pool = [...gw.entries];
  while (pool.length && gw.winnerIds.length < gw.winners) gw.winnerIds.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  save();
  const ch = await client.channels.fetch(gw.channelId).catch(() => null);
  const msg = await ch?.messages.fetch(id).catch(() => null);
  await msg?.edit({ embeds: [gwEmbed(gw)], components: [] }).catch(() => {});
  await ch?.send(gw.winnerIds.length
    ? `🎊 Glückwunsch ${gw.winnerIds.map((x) => `<@${x}>`).join(', ')}! Du gewinnst **${gw.prize}**!`
    : `😢 Beim Gewinnspiel **${gw.prize}** hat niemand teilgenommen.`).catch(() => {});
}

export function tickGiveaways(client) {
  for (const [id, gw] of Object.entries(db.giveaways))
    if (!gw.ended && gw.end <= Date.now()) endGiveaway(client, id).catch(console.error);
}
