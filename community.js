import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { db, guild, save, user } from '../db.js';
import { levelOf } from '../features/events.js';
import { startGiveaway, endGiveaway } from '../features/giveaways.js';
import { EPH, csv, embed, fail, ok } from '../lib/util.js';

const mk = (n, d, perm) => {
  const b = new SlashCommandBuilder().setName(n).setDescription(d).setDMPermission(false);
  return perm ? b.setDefaultMemberPermissions(perm) : b;
};
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export default [
  { data: mk('welcome', '👋 Willkommensnachricht & Auto-Rolle', P.ManageGuild)
      .addChannelOption((o) => o.setName('kanal').setDescription('Willkommens-Kanal').addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName('nachricht').setDescription('Platzhalter: {user} {server} {count}'))
      .addRoleOption((o) => o.setName('rolle').setDescription('Rolle für neue Mitglieder')),
    async execute(i) {
      const w = guild(i.guildId).welcome;
      if (i.options.getChannel('kanal')) w.channel = i.options.getChannel('kanal').id;
      if (i.options.getString('nachricht')) w.message = i.options.getString('nachricht');
      if (i.options.getRole('rolle')) w.role = i.options.getRole('rolle').id;
      save();
      i.reply({ embeds: [embed(`Kanal: ${w.channel ? `<#${w.channel}>` : '—'}\nRolle: ${w.role ? `<@&${w.role}>` : '—'}\nText: ${w.message}`, 0x25d366, '👋 Willkommen')] });
    } },

  { data: mk('automod', '🛡️ AutoMod einstellen', P.ManageGuild)
      .addBooleanOption((o) => o.setName('links').setDescription('Links blockieren'))
      .addBooleanOption((o) => o.setName('spam').setDescription('Spam-Schutz'))
      .addBooleanOption((o) => o.setName('caps').setDescription('CAPS-Filter'))
      .addStringOption((o) => o.setName('wort_hinzu').setDescription('Verbotene Wörter (Komma getrennt)'))
      .addStringOption((o) => o.setName('wort_weg').setDescription('Wörter wieder erlauben (Komma getrennt)')),
    async execute(i) {
      const a = guild(i.guildId).automod, o = i.options;
      for (const k of ['links', 'spam', 'caps']) if (o.getBoolean(k) !== null) a[k] = o.getBoolean(k);
      if (o.getString('wort_hinzu')) a.badwords = [...new Set([...a.badwords, ...csv(o.getString('wort_hinzu'))])];
      if (o.getString('wort_weg')) { const r = csv(o.getString('wort_weg')); a.badwords = a.badwords.filter((w) => !r.includes(w)); }
      save();
      i.reply({ embeds: [embed(`Links: ${a.links ? '🟢' : '🔴'}\nSpam: ${a.spam ? '🟢' : '🔴'}\nCAPS: ${a.caps ? '🟢' : '🔴'}\nVerbotene Wörter: ${a.badwords.length}`, 0xfee75c, '🛡️ AutoMod')], flags: EPH });
    } },

  { data: mk('giveaway', '🎉 Gewinnspiel starten', P.ManageGuild)
      .addStringOption((o) => o.setName('preis').setDescription('Was gibt es zu gewinnen?').setRequired(true))
      .addIntegerOption((o) => o.setName('minuten').setDescription('Dauer in Minuten').setMinValue(1).setMaxValue(43200).setRequired(true))
      .addIntegerOption((o) => o.setName('gewinner').setDescription('Anzahl Gewinner').setMinValue(1).setMaxValue(20)),
    async execute(i) {
      await startGiveaway(i, i.options.getString('preis'), i.options.getInteger('minuten'), i.options.getInteger('gewinner') || 1);
      i.reply({ ...ok('Gewinnspiel gestartet!'), flags: EPH });
    } },

  { data: mk('poll', '📊 Umfrage erstellen')
      .addStringOption((o) => o.setName('frage').setDescription('Frage').setRequired(true))
      .addStringOption((o) => o.setName('option1').setDescription('Option 1').setRequired(true))
      .addStringOption((o) => o.setName('option2').setDescription('Option 2').setRequired(true))
      .addStringOption((o) => o.setName('option3').setDescription('Option 3'))
      .addStringOption((o) => o.setName('option4').setDescription('Option 4'))
      .addStringOption((o) => o.setName('option5').setDescription('Option 5')),
    async execute(i) {
      const opts = [1, 2, 3, 4, 5].map((n) => i.options.getString('option' + n)).filter(Boolean);
      const msg = await i.reply({ embeds: [embed(opts.map((o, n) => `${NUM[n]} ${o}`).join('\n\n'), 0x5865f2, `📊 ${i.options.getString('frage')}`)], withResponse: true });
      const m = msg.resource?.message ?? (await i.fetchReply());
      for (let n = 0; n < opts.length; n++) await m.react(NUM[n]).catch(() => {});
    } },

  { data: mk('rollenpanel', '🎭 Rollen-Panel mit Buttons', P.ManageRoles)
      .addStringOption((o) => o.setName('titel').setDescription('Titel').setRequired(true))
      .addRoleOption((o) => o.setName('rolle1').setDescription('Rolle 1').setRequired(true))
      .addRoleOption((o) => o.setName('rolle2').setDescription('Rolle 2'))
      .addRoleOption((o) => o.setName('rolle3').setDescription('Rolle 3'))
      .addRoleOption((o) => o.setName('rolle4').setDescription('Rolle 4'))
      .addRoleOption((o) => o.setName('rolle5').setDescription('Rolle 5')),
    async execute(i) {
      const roles = [1, 2, 3, 4, 5].map((n) => i.options.getRole('rolle' + n)).filter(Boolean);
      const row = new ActionRowBuilder().addComponents(roles.map((r) =>
        new ButtonBuilder().setCustomId(`role:${r.id}`).setLabel(r.name.slice(0, 80)).setStyle(ButtonStyle.Secondary)));
      await i.channel.send({ embeds: [embed('Klicke auf einen Button, um die Rolle zu erhalten oder wieder abzugeben.', 0x5865f2, `🎭 ${i.options.getString('titel')}`)], components: [row] });
      i.reply({ ...ok('Panel erstellt.'), flags: EPH });
    } },

  { data: mk('ticket', '🎫 Ticket-System', P.ManageGuild)
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal für das Ticket-Panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption((o) => o.setName('team').setDescription('Team-Rolle, die Tickets sieht'))
      .addChannelOption((o) => o.setName('kategorie').setDescription('Kategorie für Tickets').addChannelTypes(ChannelType.GuildCategory)),
    async execute(i) {
      const t = guild(i.guildId).ticket;
      t.staffRole = i.options.getRole('team')?.id ?? t.staffRole;
      t.category = i.options.getChannel('kategorie')?.id ?? t.category;
      save();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:open').setLabel('Ticket erstellen').setEmoji('🎫').setStyle(ButtonStyle.Primary));
      await i.options.getChannel('kanal').send({ embeds: [embed('Du brauchst Hilfe? Klicke unten, um ein privates Ticket zu öffnen.', 0x5865f2, '🎫 Support')], components: [row] });
      i.reply({ ...ok('Ticket-Panel gesendet.'), flags: EPH });
    } },

  { data: mk('rank', '🏆 Dein Level').addUserOption((o) => o.setName('user').setDescription('Mitglied')),
    async execute(i) {
      const u = i.options.getUser('user') || i.user, d = user(i.guildId, u.id), l = levelOf(d.xp);
      const cur = Math.pow(l * 10, 2), next = Math.pow((l + 1) * 10, 2);
      const pct = Math.round(((d.xp - cur) / (next - cur)) * 10);
      i.reply({ embeds: [embed(`Level **${l}** • ${d.xp} XP\n${'🟩'.repeat(pct)}${'⬛'.repeat(10 - pct)}\nNoch ${next - d.xp} XP bis Level ${l + 1}`, 0xf1c40f, `🏆 ${u.username}`).setThumbnail(u.displayAvatarURL())] });
    } },

  { data: mk('top', '📈 Level-Bestenliste'),
    async execute(i) {
      const top = Object.entries(db.users[i.guildId] || {}).sort((a, b) => b[1].xp - a[1].xp).slice(0, 10);
      i.reply({ embeds: [embed(top.map(([id, d], n) => `**${n + 1}.** <@${id}> – Level ${levelOf(d.xp)} (${d.xp} XP)`).join('\n') || 'Noch niemand hat XP.', 0xf1c40f, '📈 Top 10')], allowedMentions: { parse: [] } });
    } }
];
