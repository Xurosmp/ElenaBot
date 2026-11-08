import { EmbedBuilder, MessageFlags, PermissionFlagsBits as P } from 'discord.js';

export const embed = (desc, color = 0x25d366, title) => {
  const e = new EmbedBuilder().setColor(color).setDescription(desc);
  if (title) e.setTitle(title);
  return e;
};
export const ok = (d) => ({ embeds: [embed('✅ ' + d)] });
export const fail = (d) => ({ embeds: [embed('❌ ' + d, 0xed4245)], flags: MessageFlags.Ephemeral });
export const isOwner = (i) =>
  process.env.OWNER_ID ? i.user.id === process.env.OWNER_ID : i.memberPermissions?.has(P.Administrator);
export const csv = (s) => (s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
export const uid = () => Math.random().toString(36).slice(2, 7);
export const EPH = MessageFlags.Ephemeral;
