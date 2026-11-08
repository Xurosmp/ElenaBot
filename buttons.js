import { ChannelType, PermissionFlagsBits as P } from 'discord.js';
import { db, guild, save } from '../db.js';
import { getFeed, panel } from '../lib/feeds.js';
import { embed, EPH } from '../lib/util.js';
import { deliver } from '../mirror.js';
import { gwEmbed } from './giveaways.js';

export async function onButton(i) {
  const [kind, action, arg] = i.customId.split(':');
  if (kind === 'feed') return feedBtn(i, action, arg);
  if (kind === 'gw') return gwJoin(i);
  if (kind === 'role') return roleToggle(i, action);
  if (kind === 'ticket') return ticketBtn(i, action);
}

async function feedBtn(i, action, id) {
  if (!i.memberPermissions.has(P.ManageGuild)) return i.reply({ content: '❌ Dafür brauchst du „Server verwalten“.', flags: EPH });
  const g = guild(i.guildId), f = getFeed(i.guildId, id);
  if (!f) return i.reply({ content: '❌ Feed existiert nicht mehr.', flags: EPH });
  if (action === 'pause') f.paused = !f.paused;
  if (action === 'threads') f.threads = !f.threads;
  if (action === 'publish') f.publish = !f.publish;
  if (action === 'remove') {
    g.feeds = g.feeds.filter((x) => x.id !== id); save();
    return i.update({ embeds: [embed(`🗑️ Feed **${f.name}** wurde entfernt.`, 0xed4245)], components: [] });
  }
  if (action === 'test') {
    await i.deferReply({ flags: EPH });
    try {
      await deliver(i.client, i.guildId, g, f, { id: 'test', jid: f.jid, ts: Math.floor(Date.now() / 1000), text: '🧪 *Testnachricht* – wenn du das siehst, funktioniert die Spiegelung!' }, true);
      return i.editReply('✅ Testbeitrag gesendet.');
    } catch (e) { return i.editReply('❌ ' + e.message); }
  }
  save();
  return i.update(panel(f));
}

async function gwJoin(i) {
  const gw = db.giveaways[i.message.id];
  if (!gw || gw.ended) return i.reply({ content: '❌ Dieses Gewinnspiel ist beendet.', flags: EPH });
  const joined = !gw.entries.includes(i.user.id);
  gw.entries = joined ? [...gw.entries, i.user.id] : gw.entries.filter((x) => x !== i.user.id);
  save();
  await i.update({ embeds: [gwEmbed(gw)] });
  i.followUp({ content: joined ? '🎉 Du bist dabei!' : '👋 Teilnahme zurückgezogen.', flags: EPH });
}

async function roleToggle(i, roleId) {
  const has = i.member.roles.cache.has(roleId);
  try {
    await (has ? i.member.roles.remove(roleId) : i.member.roles.add(roleId));
    i.reply({ content: has ? `➖ Rolle <@&${roleId}> entfernt.` : `➕ Rolle <@&${roleId}> erhalten.`, flags: EPH, allowedMentions: { parse: [] } });
  } catch { i.reply({ content: '❌ Ich kann diese Rolle nicht vergeben (meine Rolle muss höher stehen).', flags: EPH }); }
}

async function ticketBtn(i, action) {
  const g = guild(i.guildId);
  if (action === 'open') {
    const name = `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
    const ex = i.guild.channels.cache.find((c) => c.name === name);
    if (ex) return i.reply({ content: `Du hast schon ein Ticket: ${ex}`, flags: EPH });
    const perm = [P.ViewChannel, P.SendMessages, P.AttachFiles, P.ReadMessageHistory];
    const ch = await i.guild.channels.create({
      name, type: ChannelType.GuildText, parent: g.ticket.category || undefined,
      permissionOverwrites: [
        { id: i.guild.id, deny: [P.ViewChannel] },
        { id: i.user.id, allow: perm },
        { id: i.client.user.id, allow: [...perm, P.ManageChannels] },
        ...(g.ticket.staffRole ? [{ id: g.ticket.staffRole, allow: perm }] : [])
      ]
    }).catch(() => null);
    if (!ch) return i.reply({ content: '❌ Ticket konnte nicht erstellt werden (fehlt mir „Kanäle verwalten“?).', flags: EPH });
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    await ch.send({
      content: `${i.user}${g.ticket.staffRole ? ` <@&${g.ticket.staffRole}>` : ''}`,
      embeds: [embed('Beschreibe dein Anliegen – das Team meldet sich bald. 🎫', 0x5865f2, 'Ticket eröffnet')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:close').setLabel('Schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger))]
    });
    return i.reply({ content: `✅ Ticket erstellt: ${ch}`, flags: EPH });
  }
  if (action === 'close') {
    const mine = i.channel.name === `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
    if (!mine && !i.memberPermissions.has(P.ManageChannels) && !(g.ticket.staffRole && i.member.roles.cache.has(g.ticket.staffRole)))
      return i.reply({ content: '❌ Das darfst du nicht.', flags: EPH });
    await i.reply('🔒 Ticket wird in 5 Sekunden geschlossen …');
    setTimeout(() => i.channel.delete().catch(() => {}), 5000);
  }
}
