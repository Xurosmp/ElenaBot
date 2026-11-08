import { PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { guild, save, user } from '../db.js';
import { EPH, embed, fail, ok } from '../lib/util.js';

const mk = (n, d, perm) => new SlashCommandBuilder().setName(n).setDescription(d).setDefaultMemberPermissions(perm).setDMPermission(false);
const userOpt = (o) => o.setName('user').setDescription('Mitglied').setRequired(true);
const reason = (o) => o.setName('grund').setDescription('Grund');

export default [
  { data: mk('kick', '👢 Mitglied kicken', P.KickMembers).addUserOption(userOpt).addStringOption(reason),
    async execute(i) {
      const m = i.options.getMember('user');
      if (!m?.kickable) return i.reply(fail('Das kann ich nicht kicken.'));
      await m.kick(i.options.getString('grund') || undefined);
      i.reply(ok(`**${m.user.tag}** wurde gekickt.`));
    } },
  { data: mk('ban', '🔨 Mitglied bannen', P.BanMembers).addUserOption(userOpt).addStringOption(reason),
    async execute(i) {
      const u = i.options.getUser('user');
      const m = i.options.getMember('user');
      if (m && !m.bannable) return i.reply(fail('Das kann ich nicht bannen.'));
      await i.guild.members.ban(u, { reason: i.options.getString('grund') || undefined }).catch(() => null);
      i.reply(ok(`**${u.tag}** wurde gebannt.`));
    } },
  { data: mk('timeout', '🔇 Mitglied stummschalten', P.ModerateMembers).addUserOption(userOpt)
      .addIntegerOption((o) => o.setName('minuten').setDescription('Dauer (0 = aufheben)').setMinValue(0).setMaxValue(40320).setRequired(true)).addStringOption(reason),
    async execute(i) {
      const m = i.options.getMember('user'), min = i.options.getInteger('minuten');
      if (!m?.moderatable) return i.reply(fail('Das kann ich nicht.'));
      await m.timeout(min ? min * 60000 : null, i.options.getString('grund') || undefined);
      i.reply(ok(min ? `${m} für ${min} Min. stummgeschaltet.` : `Timeout von ${m} aufgehoben.`));
    } },
  { data: mk('clear', '🧹 Nachrichten löschen', P.ManageMessages)
      .addIntegerOption((o) => o.setName('anzahl').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true)),
    async execute(i) {
      const d = await i.channel.bulkDelete(i.options.getInteger('anzahl'), true).catch(() => null);
      i.reply({ ...ok(`${d?.size ?? 0} Nachrichten gelöscht.`), flags: EPH });
    } },
  { data: mk('warn', '⚠️ Mitglied verwarnen (3 Warns = 1h Timeout)', P.ModerateMembers).addUserOption(userOpt).addStringOption(reason),
    async execute(i) {
      const m = i.options.getMember('user');
      const u = user(i.guildId, i.options.getUser('user').id);
      u.warns.push({ by: i.user.id, reason: i.options.getString('grund') || 'kein Grund', ts: Date.now() });
      save();
      let extra = '';
      if (u.warns.length % 3 === 0 && m?.moderatable) { await m.timeout(3600000, '3 Verwarnungen'); extra = '\n🔇 Automatisch 1 Stunde stummgeschaltet.'; }
      i.reply(ok(`${i.options.getUser('user')} verwarnt (**${u.warns.length}** insgesamt).${extra}`));
    } },
  { data: mk('warnings', '📋 Verwarnungen anzeigen', P.ModerateMembers).addUserOption(userOpt),
    async execute(i) {
      const u = user(i.guildId, i.options.getUser('user').id);
      i.reply({ embeds: [embed(u.warns.map((w, n) => `**${n + 1}.** ${w.reason} – <t:${Math.floor(w.ts / 1000)}:R>`).join('\n') || 'Keine Verwarnungen. ✨', 0xfee75c, `Verwarnungen: ${i.options.getUser('user').tag}`)] });
    } },
  { data: mk('slowmode', '🐢 Slowmode setzen', P.ManageChannels)
      .addIntegerOption((o) => o.setName('sekunden').setDescription('0 = aus').setMinValue(0).setMaxValue(21600).setRequired(true)),
    async execute(i) { await i.channel.setRateLimitPerUser(i.options.getInteger('sekunden')); i.reply(ok('Slowmode aktualisiert.')); } },
  { data: mk('lock', '🔒 Kanal sperren', P.ManageChannels),
    async execute(i) { await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: false }); i.reply(ok('Kanal gesperrt.')); } },
  { data: mk('unlock', '🔓 Kanal entsperren', P.ManageChannels),
    async execute(i) { await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: null }); i.reply(ok('Kanal entsperrt.')); } }
];
