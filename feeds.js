import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { guild, save } from '../db.js';
import { uid } from './util.js';

export function addFeed(gid, meta, channelId, roleId) {
  const f = {
    id: uid(), jid: meta.jid, name: meta.name, invite: meta.invite, avatar: meta.avatar,
    channelId, roleId: roleId || null, threads: false, publish: false, reactions: [],
    include: [], exclude: [], paused: false, useWebhook: true, color: '#25D366', webhook: null,
    count: 0, created: Date.now()
  };
  guild(gid).feeds.push(f);
  save();
  return f;
}
export const getFeed = (gid, id) => guild(gid).feeds.find((f) => f.id === id);

export function panel(f) {
  const e = new EmbedBuilder()
    .setColor(f.color || '#25D366')
    .setTitle(`📲 ${f.name}`)
    .setDescription(`Wird live nach <#${f.channelId}> gespiegelt.`)
    .addFields(
      { name: 'Status', value: f.paused ? '⏸️ Pausiert' : '🟢 Aktiv', inline: true },
      { name: 'Ping-Rolle', value: f.roleId ? `<@&${f.roleId}>` : '—', inline: true },
      { name: 'Threads', value: f.threads ? 'An' : 'Aus', inline: true },
      { name: 'Auto-Publish', value: f.publish ? 'An' : 'Aus', inline: true },
      { name: 'Beiträge', value: String(f.count), inline: true },
      { name: 'Feed-ID', value: `\`${f.id}\``, inline: true }
    )
    .setFooter({ text: 'Mehr Optionen: /feed settings' });
  const b = (id, label, emoji, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`feed:${id}:${f.id}`).setLabel(label).setEmoji(emoji).setStyle(style);
  const row = new ActionRowBuilder().addComponents(
    b('pause', f.paused ? 'Fortsetzen' : 'Pausieren', f.paused ? '▶️' : '⏸️'),
    b('threads', 'Threads', '🧵'),
    b('publish', 'Auto-Publish', '📣'),
    b('test', 'Test', '🧪', ButtonStyle.Success),
    b('remove', 'Entfernen', '🗑️', ButtonStyle.Danger)
  );
  return { embeds: [e], components: [row] };
}
