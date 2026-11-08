import { ChannelType, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { db, guild, save } from '../db.js';
import { addFeed, getFeed, panel } from '../lib/feeds.js';
import { EPH, csv, embed, fail, ok } from '../lib/util.js';
import { deliver } from '../mirror.js';
import { resolveChannel, st } from '../whatsapp.js';

const idOpt = (o) => o.setName('id').setDescription('Feed').setRequired(true).setAutocomplete(true);
const chOpt = (o) => o.setName('ziel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

export default [{
  data: new SlashCommandBuilder()
    .setName('feed').setDescription('📡 WhatsApp-Kanäle verwalten')
    .addSubcommand((s) => s.setName('add').setDescription('Weiteren WhatsApp-Kanal hinzufügen')
      .addStringOption((o) => o.setName('kanal').setDescription('WhatsApp-Kanal-Link').setRequired(true))
      .addChannelOption((o) => chOpt(o).setDescription('Discord-Kanal').setRequired(true))
      .addRoleOption((o) => o.setName('rolle').setDescription('Ping-Rolle')))
    .addSubcommand((s) => s.setName('remove').setDescription('Feed entfernen').addStringOption(idOpt))
    .addSubcommand((s) => s.setName('list').setDescription('Alle Feeds anzeigen'))
    .addSubcommand((s) => s.setName('panel').setDescription('Steuerpanel öffnen').addStringOption(idOpt))
    .addSubcommand((s) => s.setName('settings').setDescription('Feed-Einstellungen')
      .addStringOption(idOpt)
      .addRoleOption((o) => o.setName('rolle').setDescription('Ping-Rolle setzen'))
      .addBooleanOption((o) => o.setName('ping_aus').setDescription('Ping-Rolle entfernen'))
      .addChannelOption((o) => chOpt(o).setDescription('Neuer Ziel-Kanal'))
      .addBooleanOption((o) => o.setName('threads').setDescription('Für jeden Beitrag einen Thread erstellen'))
      .addBooleanOption((o) => o.setName('publish').setDescription('Auto-Publish in Ankündigungskanälen'))
      .addBooleanOption((o) => o.setName('webhook').setDescription('Mit Name & Avatar des WhatsApp-Kanals posten'))
      .addStringOption((o) => o.setName('reaktionen').setDescription('Emojis, die automatisch angehängt werden (Leerzeichen getrennt)'))
      .addStringOption((o) => o.setName('nur_wenn').setDescription('Nur Beiträge mit diesen Wörtern (Komma getrennt, "-" = löschen)'))
      .addStringOption((o) => o.setName('nie_wenn').setDescription('Beiträge mit diesen Wörtern ignorieren (Komma getrennt, "-" = löschen)'))
      .addStringOption((o) => o.setName('farbe').setDescription('Embed-Farbe als Hex, z.B. #25D366')))
    .addSubcommand((s) => s.setName('test').setDescription('Testbeitrag senden').addStringOption(idOpt))
    .addSubcommand((s) => s.setName('latest').setDescription('Letzte gespiegelte Beiträge')
      .addIntegerOption((o) => o.setName('anzahl').setDescription('1-10').setMinValue(1).setMaxValue(10)))
    .addSubcommand((s) => s.setName('search').setDescription('Beiträge durchsuchen')
      .addStringOption((o) => o.setName('begriff').setDescription('Suchbegriff').setRequired(true)))
    .setDefaultMemberPermissions(P.ManageGuild).setDMPermission(false),

  async autocomplete(i) {
    const q = i.options.getFocused().toLowerCase();
    await i.respond(guild(i.guildId).feeds
      .filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q)).slice(0, 25)
      .map((f) => ({ name: `${f.name} (${f.id})`.slice(0, 100), value: f.id })));
  },

  async execute(i) {
    const g = guild(i.guildId), sub = i.options.getSubcommand();
    const feed = ['remove', 'panel', 'settings', 'test'].includes(sub) ? getFeed(i.guildId, i.options.getString('id')) : null;
    if (['remove', 'panel', 'settings', 'test'].includes(sub) && !feed) return i.reply(fail('Feed nicht gefunden.'));

    if (sub === 'add') {
      await i.deferReply();
      if (st.status !== 'connected') return i.editReply(fail('WhatsApp ist nicht verbunden.'));
      try {
        const meta = await resolveChannel(i.options.getString('kanal'));
        const f = addFeed(i.guildId, meta, i.options.getChannel('ziel').id, i.options.getRole('rolle')?.id);
        return i.editReply(panel(f));
      } catch (e) { return i.editReply(fail(e.message)); }
    }
    if (sub === 'remove') { g.feeds = g.feeds.filter((f) => f !== feed); save(); return i.reply(ok(`Feed **${feed.name}** entfernt.`)); }
    if (sub === 'panel') return i.reply(panel(feed));
    if (sub === 'list') {
      if (!g.feeds.length) return i.reply(fail('Noch keine Feeds. Starte mit `/setup`.'));
      return i.reply({ embeds: [embed(g.feeds.map((f) => `${f.paused ? '⏸️' : '🟢'} **${f.name}** → <#${f.channelId}> • \`${f.id}\` • ${f.count} Beiträge`).join('\n'), 0x25d366, '📡 Feeds')] });
    }
    if (sub === 'settings') {
      const o = i.options;
      if (o.getRole('rolle')) feed.roleId = o.getRole('rolle').id;
      if (o.getBoolean('ping_aus')) feed.roleId = null;
      if (o.getChannel('ziel')) { feed.channelId = o.getChannel('ziel').id; feed.webhook = null; }
      for (const [k, opt] of [['threads', 'threads'], ['publish', 'publish'], ['useWebhook', 'webhook']])
        if (o.getBoolean(opt) !== null) feed[k] = o.getBoolean(opt);
      if (o.getString('reaktionen') !== null) feed.reactions = o.getString('reaktionen').split(/\s+/).filter(Boolean).slice(0, 5);
      if (o.getString('nur_wenn') !== null) feed.include = o.getString('nur_wenn') === '-' ? [] : csv(o.getString('nur_wenn'));
      if (o.getString('nie_wenn') !== null) feed.exclude = o.getString('nie_wenn') === '-' ? [] : csv(o.getString('nie_wenn'));
      const c = o.getString('farbe');
      if (c) { if (!/^#?[0-9a-f]{6}$/i.test(c)) return i.reply(fail('Ungültige Farbe, z.B. `#25D366`.')); feed.color = c.startsWith('#') ? c : '#' + c; }
      save();
      const p = panel(feed);
      p.embeds[0].addFields(
        { name: 'Nur wenn', value: feed.include.join(', ') || '—', inline: true },
        { name: 'Nie wenn', value: feed.exclude.join(', ') || '—', inline: true },
        { name: 'Reaktionen', value: feed.reactions.join(' ') || '—', inline: true });
      return i.reply(p);
    }
    if (sub === 'test') {
      await i.deferReply({ flags: EPH });
      try {
        await deliver(i.client, i.guildId, g, feed, { id: 'test', jid: feed.jid, ts: Math.floor(Date.now() / 1000), text: '🧪 *Testnachricht* – die Spiegelung funktioniert! https://whatsapp.com' }, true);
        return i.editReply('✅ Testbeitrag gesendet.');
      } catch (e) { return i.editReply('❌ ' + e.message); }
    }
    if (sub === 'latest' || sub === 'search') {
      const q = sub === 'search' ? i.options.getString('begriff').toLowerCase() : null;
      const n = i.options.getInteger('anzahl') || 5;
      const list = db.history.filter((h) => h.gid === i.guildId && (!q || h.text.toLowerCase().includes(q))).slice(-n).reverse();
      if (!list.length) return i.reply(fail('Nichts gefunden.'));
      return i.reply({ embeds: [embed(list.map((h) => `**${h.name}** • <t:${h.ts}:R>\n${h.text.slice(0, 120) || '*Medien*'}${h.url ? `\n[→ Beitrag](${h.url})` : ''}`).join('\n\n'), 0x25d366, q ? `🔎 „${q}“` : '🕘 Letzte Beiträge')] });
    }
  }
}];
