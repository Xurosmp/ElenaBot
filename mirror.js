import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } from 'discord.js';
import { db, save } from './db.js';
import { logTo } from './lib/log.js';
import { embed } from './lib/util.js';

const URL_RE = /https?:\/\/[^\s<>]+/i;

// WhatsApp-Formatierung -> Discord-Markdown
const fmt = (t = '') =>
  t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1**$2**')
   .replace(/(^|[\s(])~([^~\n]+)~(?=[\s).,!?:;]|$)/g, '$1~~$2~~');

export async function mirror(client, post) {
  if (db.seen.includes(post.id)) return;
  db.seen.push(post.id);
  if (db.seen.length > 1000) db.seen.splice(0, 500);
  for (const [gid, g] of Object.entries(db.guilds)) {
    for (const feed of g.feeds) {
      if (feed.jid !== post.jid) continue;
      try { await deliver(client, gid, g, feed, post); }
      catch (e) {
        console.error('[Mirror]', e.message);
        logTo(client, gid, embed(`Beitrag aus **${feed.name}** konnte nicht gespiegelt werden:\n\`${e.message}\``, 0xed4245, '⚠️ Fehler'));
      }
    }
  }
  save();
}

async function viaWebhook(client, ch, feed, payload) {
  if (!ch.createWebhook) return null;
  let wh = feed.webhook ? await client.fetchWebhook(feed.webhook.id, feed.webhook.token).catch(() => null) : null;
  if (!wh) {
    const name = feed.name.slice(0, 80);
    wh = await ch.createWebhook({ name, avatar: feed.avatar || undefined }).catch(() => ch.createWebhook({ name }).catch(() => null));
    if (!wh) return null;
    feed.webhook = { id: wh.id, token: wh.token };
    save();
  }
  return wh.send({ ...payload, username: feed.name.slice(0, 80), avatarURL: feed.avatar || undefined });
}

export async function deliver(client, gid, g, feed, post, force = false) {
  if (!force) {
    if (feed.paused) return;
    const t = (post.text || '').toLowerCase();
    if (feed.include.length && !feed.include.some((k) => t.includes(k))) return;
    if (feed.exclude.some((k) => t.includes(k))) return;
  }
  const ch = await client.channels.fetch(feed.channelId).catch(() => null);
  if (!ch?.isTextBased()) throw new Error('Zielkanal nicht gefunden');

  const text = fmt(post.text || '');
  const e = new EmbedBuilder()
    .setColor(feed.color || '#25D366')
    .setAuthor({ name: `${feed.name} • WhatsApp-Kanal`, iconURL: feed.avatar || undefined })
    .setTimestamp(post.ts * 1000)
    .setFooter({ text: '📲 Live aus WhatsApp gespiegelt' });
  if (text) e.setDescription(text.slice(0, 4000));

  const files = [];
  if (post.media) {
    files.push(new AttachmentBuilder(post.media.buffer, { name: post.media.filename }));
    if (['image', 'sticker'].includes(post.media.kind)) e.setImage('attachment://' + post.media.filename);
  } else if (post.mediaSkipped) e.addFields({ name: '📎 Medien', value: post.mediaSkipped });
  if (!text && !post.media && !post.mediaSkipped) e.setDescription('📩 Neuer Beitrag – siehe WhatsApp.');

  const links = [];
  const url = text.match(URL_RE)?.[0]?.replace(/[).,!?]+$/, '');
  if (url) links.push({ label: '🔗 Link öffnen', url });
  if (feed.invite) links.push({ label: '📲 WhatsApp-Kanal', url: `https://whatsapp.com/channel/${feed.invite}` });

  const payload = {
    content: feed.roleId ? `<@&${feed.roleId}>` : undefined,
    embeds: [e], files,
    allowedMentions: { roles: feed.roleId ? [feed.roleId] : [] }
  };

  let sent = null;
  if (feed.useWebhook !== false) {
    // Webhook-Nachrichten: Links als Feld statt Buttons
    const hookPayload = { ...payload, embeds: [EmbedBuilder.from(e)] };
    if (links.length) hookPayload.embeds[0].addFields({ name: '\u200b', value: links.map((l) => `[${l.label}](${l.url})`).join(' • ') });
    sent = await viaWebhook(client, ch, feed, hookPayload).catch(() => null);
  }
  if (!sent) {
    if (links.length) payload.components = [new ActionRowBuilder().addComponents(
      links.map((l) => new ButtonBuilder().setLabel(l.label.replace(/^\S+\s/, '')).setStyle(ButtonStyle.Link).setURL(l.url)))];
    sent = await ch.send(payload);
  }

  const msg = await ch.messages.fetch(sent.id).catch(() => null);
  if (msg) {
    if (feed.publish && ch.type === ChannelType.GuildAnnouncement) await msg.crosspost().catch(() => {});
    for (const r of feed.reactions) await msg.react(r).catch(() => {});
    if (feed.threads) {
      const title = (post.text || 'Neuer Beitrag').split('\n')[0].slice(0, 90) || 'Neuer Beitrag';
      await msg.startThread({ name: title, autoArchiveDuration: 1440 }).catch(() => {});
    }
  }

  if (!force) {
    feed.count++;
    g.stats.posts++;
    db.history.push({ gid, feed: feed.id, name: feed.name, text: (post.text || '').slice(0, 300), ts: post.ts, url: msg?.url });
    if (db.history.length > 500) db.history.splice(0, 100);
    save();
    logTo(client, gid, embed(`Neuer Beitrag aus **${feed.name}** in <#${feed.channelId}> gespiegelt.`, 0x25d366, '📲 Gespiegelt'));
  }
}
