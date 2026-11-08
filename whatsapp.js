import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { EPH, embed, fail, isOwner } from '../lib/util.js';
import { logout, pair, qrPng, st } from '../whatsapp.js';

export default [{
  data: new SlashCommandBuilder()
    .setName('whatsapp').setDescription('🔌 WhatsApp-Verbindung verwalten (nur Bot-Besitzer)')
    .addSubcommand((s) => s.setName('connect').setDescription('Per Kopplungscode verbinden')
      .addStringOption((o) => o.setName('nummer').setDescription('WhatsApp-Nummer mit Ländervorwahl, z.B. 491701234567').setRequired(true)))
    .addSubcommand((s) => s.setName('qr').setDescription('QR-Code zum Verbinden anzeigen'))
    .addSubcommand((s) => s.setName('status').setDescription('Verbindungsstatus'))
    .addSubcommand((s) => s.setName('logout').setDescription('Verbindung trennen'))
    .setDMPermission(false),

  async execute(i) {
    if (!isOwner(i)) return i.reply(fail('Nur der Bot-Besitzer darf das (OWNER_ID).'));
    const sub = i.options.getSubcommand();
    if (sub === 'status') {
      const map = { connected: '🟢 Verbunden', connecting: '🟡 Verbindet …', waiting: '🟠 Wartet auf Kopplung', disconnected: '🔴 Getrennt' };
      return i.reply({ embeds: [embed(`${map[st.status] || st.status}${st.since ? `\nSeit <t:${Math.floor(st.since / 1000)}:R>` : ''}`, 0x25d366, '📱 WhatsApp')], flags: EPH });
    }
    if (sub === 'connect') {
      await i.deferReply({ flags: EPH });
      try {
        const code = await pair(i.options.getString('nummer'));
        return i.editReply({ embeds: [embed(`Dein Code: **\`${code}\`**\n\nWhatsApp → *Einstellungen* → *Verknüpfte Geräte* → *Gerät hinzufügen* → **Stattdessen mit Telefonnummer verknüpfen** → Code eingeben.`, 0x25d366, '🔗 Kopplungscode')] });
      } catch (e) { return i.editReply(fail(e.message)); }
    }
    if (sub === 'qr') {
      const png = await qrPng();
      if (!png) return i.reply(fail('Kein QR-Code verfügbar (evtl. schon verbunden).'));
      return i.reply({ content: 'WhatsApp → Verknüpfte Geräte → Gerät hinzufügen → scannen:', files: [new AttachmentBuilder(png, { name: 'qr.png' })], flags: EPH });
    }
    if (sub === 'logout') { await logout(); return i.reply({ content: '👋 Getrennt. Mit `/whatsapp connect` neu verbinden.', flags: EPH }); }
  }
}];
