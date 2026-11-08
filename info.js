import { SlashCommandBuilder } from 'discord.js';
import { db, guild } from '../db.js';
import { embed } from '../lib/util.js';
import { st } from '../whatsapp.js';

const mk = (n, d) => new SlashCommandBuilder().setName(n).setDescription(d).setDMPermission(false);

export default [
  { data: mk('help', '📖 Alle Funktionen im Überblick'),
    async execute(i) {
      i.reply({ embeds: [embed(
        '**📲 WhatsApp-Spiegelung**\n`/setup` `/feed` `/whatsapp`\n\n' +
        '**🛡️ Moderation**\n`/kick` `/ban` `/timeout` `/warn` `/warnings` `/clear` `/slowmode` `/lock` `/unlock` `/automod`\n\n' +
        '**🎉 Community**\n`/giveaway` `/poll` `/rollenpanel` `/ticket` `/welcome` `/rank` `/top`\n\n' +
        '**ℹ️ Info**\n`/stats` `/serverinfo` `/userinfo` `/ping`', 0x25d366, '📖 Hilfe')] });
    } },
  { data: mk('ping', '🏓 Latenz'),
    async execute(i) { i.reply(`🏓 Pong! **${i.client.ws.ping} ms**`); } },
  { data: mk('stats', '📊 Bot-Statistiken'),
    async execute(i) {
      const g = guild(i.guildId);
      const up = Math.floor(process.uptime());
      i.reply({ embeds: [embed(
        `📱 WhatsApp: **${st.status}**\n📡 Feeds hier: **${g.feeds.length}**\n📨 Gespiegelte Beiträge: **${g.stats.posts}**\n` +
        `🌍 Server gesamt: **${i.client.guilds.cache.size}**\n⏱️ Uptime: **${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m**`, 0x25d366, '📊 Statistiken')] });
    } },
  { data: mk('serverinfo', '🏠 Serverinfo'),
    async execute(i) {
      const s = i.guild;
      i.reply({ embeds: [embed(`👥 Mitglieder: **${s.memberCount}**\n📅 Erstellt: <t:${Math.floor(s.createdTimestamp / 1000)}:D>\n👑 Besitzer: <@${s.ownerId}>\n💬 Kanäle: **${s.channels.cache.size}**\n🎭 Rollen: **${s.roles.cache.size}**\n🚀 Boosts: **${s.premiumSubscriptionCount || 0}**`, 0x5865f2, s.name).setThumbnail(s.iconURL())] });
    } },
  { data: mk('userinfo', '👤 Userinfo').addUserOption((o) => o.setName('user').setDescription('Mitglied')),
    async execute(i) {
      const u = i.options.getUser('user') || i.user, m = await i.guild.members.fetch(u.id).catch(() => null);
      i.reply({ embeds: [embed(`🆔 \`${u.id}\`\n📅 Account: <t:${Math.floor(u.createdTimestamp / 1000)}:R>\n${m ? `📥 Beigetreten: <t:${Math.floor(m.joinedTimestamp / 1000)}:R>` : ''}`, 0x5865f2, u.tag).setThumbnail(u.displayAvatarURL())] });
    } }
];
