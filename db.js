import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.DATA_DIR || './data';
fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, 'db.json');

export const db = { guilds: {}, users: {}, history: [], giveaways: {}, seen: [] };
try { Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch {}

let timer;
export function flush() {
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(FILE + '.tmp', FILE);
}
export function save() { clearTimeout(timer); timer = setTimeout(flush, 400); }
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { flush(); } catch {} process.exit(0); });

const defaults = () => ({
  setupDone: false,
  feeds: [],
  logChannel: null,
  welcome: { channel: null, message: 'Willkommen {user} auf **{server}**! 🎉 Du bist Mitglied #{count}.', role: null },
  automod: { links: false, spam: true, caps: false, badwords: [] },
  levels: { enabled: true },
  ticket: { category: null, staffRole: null },
  stats: { posts: 0 }
});

export function guild(id) {
  if (!db.guilds[id]) { db.guilds[id] = defaults(); save(); }
  return db.guilds[id];
}
export function user(gid, uid) {
  db.users[gid] ??= {};
  db.users[gid][uid] ??= { xp: 0, warns: [] };
  return db.users[gid][uid];
}
