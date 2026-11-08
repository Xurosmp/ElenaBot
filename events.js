import { PermissionFlagsBits as P } from 'discord.js';
import { guild, user, save } from '../db.js';
import { embed } from '../lib/util.js';
import { logTo } from '../lib/log.js';

export const levelOf = (xp) => Math.floor(0.1 * Math.sqrt(xp));
const cooldown = new Map();
const spam = new Map();

export async function onMessage(m) {
  if (!m.guild || m.author.bot || !m.member) return;
  const g = guild(m.guild.id);

  // ---- AutoMod ----
  if (!m.member.permissions.has(P.ManageMessages)) {
    const a = g.automod, t = m.content || '';
    let why = null;
    if (a.badwords.some((w) => t.toLowerCase().includes(w))) why = 'Dieses Wort ist hier nicht erlaubt';
    else if (a.links && /(https?:\/\/|discord\.gg\/)/i.test(t)) why = 'Links sind hier nicht erlaubt';
    else if (a.caps && t.length >= 12 &&
      t.replace(/[^A-ZÄÖÜ]/g, '').length / Math.max(1, t.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length) > 0.7) why = 'Bitte nicht nur in CAPS schreiben';
    if (!why && a.spam) {
      const k = m.guild.id + m.author.id, now = Date.now();
      const arr = (spam.get(k) || []).filter((x) => now - x < 5000);
      arr.push(now); spam.set(k, arr);
      if (arr.length >= 6) { spam.set(k, []); await m.member.timeout(60_000, 'Spam').catch(() => {}); why = 'Spam erkannt – 1 Minute Timeout'; }
    }
    if (why) {
      await m.delete().catch(() => {});
      const n = await m.channel.send({ embeds: [embed(`🛡️ ${m.author}, ${why}.`, 0xfee75c)] }).catch(() => null);
      setTimeout(() => n?.delete().catch(() => {}), 5000);
      logTo(m.client, m.guild.id, embed(`${m.author} in ${m.channel}: **${why}**\n\`\`\`${t.slice(0, 300)}\`\`\``, 0xfee75c, '🛡️ AutoMod'));
      return;
    }
  }

  // ---- Levels ----
  if (g.levels.enabled) {
    const k = m.guild.id + m.author.id, now = Date.now();
    if (now - (cooldown.get(k) || 0) < 60_000) return;
    cooldown.set(k, now);
    const u = user(m.guild.id, m.author.id);
    const before = levelOf(u.xp);
    u.xp += 15 + Math.floor(Math.random() * 11);
    const after = levelOf(u.xp);
    save();
    if (after > before) m.channel.send({ embeds: [embed(`🎊 ${m.author} ist jetzt **Level ${after}**!`, 0xf1c40f)] }).catch(() => {});
  }
}

export async function onMemberAdd(member) {
  const g = guild(member.guild.id);
  if (g.welcome.role) member.roles.add(g.welcome.role).catch(() => {});
  if (g.welcome.channel) {
    const ch = await member.client.channels.fetch(g.welcome.channel).catch(() => null);
    const text = g.welcome.message.replace('{user}', `${member}`).replace('{server}', member.guild.name).replace('{count}', member.guild.memberCount);
    ch?.send({ embeds: [embed(text, 0x25d366, '👋 Willkommen!').setThumbnail(member.displayAvatarURL())] }).catch(() => {});
  }
  logTo(member.client, member.guild.id, embed(`${member} (${member.user.tag}) ist beigetreten.`, 0x57f287, '📥 Beitritt'));
}
export const onMemberRemove = (member) =>
  logTo(member.client, member.guild.id, embed(`**${member.user.tag}** hat den Server verlassen.`, 0xed4245, '📤 Austritt'));
export function onDelete(msg) {
  if (!msg.guild || msg.author?.bot || !msg.content) return;
  logTo(msg.client, msg.guild.id, embed(`Von ${msg.author} in ${msg.channel}:\n${msg.content.slice(0, 1000)}`, 0xfee75c, '🗑️ Nachricht gelöscht'));
}
