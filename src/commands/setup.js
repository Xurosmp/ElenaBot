import { ChannelType, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { guild, save } from '../db.js';
import { addFeed, panel } from '../lib/feeds.js';
import { EPH, embed, fail } from '../lib/util.js';
import { resolveChannel, st } from '../whatsapp.js';

export default [{
  data: new SlashCommandBuilder()
    .setName('setup').setDescription('🚀 Spiegelt einen WhatsApp-Kanal in einen Discord-Kanal')
    .addStringOption((o) => o.setName('kanal').setDescription('WhatsApp-Kanal-Link (https://whatsapp.com/channel/…)').setRequired(true))
    .addChannelOption((o) => o.setName('ziel').setDescription('Discord-Kanal für die Beiträge')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addRoleOption((o) => o.setName('rolle').setDescription('Rolle, die bei neuen Beiträgen gepingt wird'))
    .addChannelOption((o) => o.setName('log').setDescription('Kanal für Logs (Beiträge, Fehler, Joins …)').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(P.ManageGuild).setDMPermission(false),

  async execute(i) {
    await i.deferReply();
    if (st.status !== 'connected')
      return i.editReply(fail('Der Bot ist noch nicht mit WhatsApp verbunden. Der Bot-Besitzer muss zuerst `/whatsapp connect` ausführen.'));
    const target = i.options.getChannel('ziel');
    const me = i.guild.members.me;
    const need = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles];
    if (!target.permissionsFor(me).has(need))
      return i.editReply(fail(`Mir fehlen Rechte in ${target} (Kanal sehen, Nachrichten senden, Links einbetten, Dateien anhängen).`));
    let meta;
    try { meta = await resolveChannel(i.options.getString('kanal')); }
    catch (e) { return i.editReply(fail(e.message)); }

    const g = guild(i.guildId);
    if (g.feeds.some((f) => f.jid === meta.jid && f.channelId === target.id))
      return i.editReply(fail('Dieser WhatsApp-Kanal wird schon in diesen Discord-Kanal gespiegelt.'));
    const feed = addFeed(i.guildId, meta, target.id, i.options.getRole('rolle')?.id);
    const log = i.options.getChannel('log');
    if (log) g.logChannel = log.id;
    g.setupDone = true; save();

    const p = panel(feed);
    p.content = `🎉 **Setup abgeschlossen!** Neue Beiträge aus **${meta.name}** erscheinen ab jetzt live in ${target}.\n` +
      `Tipp: \`/feed settings\`, \`/welcome\`, \`/automod\`, \`/ticket panel\`, \`/giveaway\`, \`/help\` – der Server wartet auf dich. 🚀`;
    return i.editReply(p);
  }
}];
