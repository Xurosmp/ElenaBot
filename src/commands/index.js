import setup from './setup.js';
import whatsapp from './whatsapp.js';
import feed from './feed.js';
import moderation from './moderation.js';
import community from './community.js';
import info from './info.js';
export const commands = [...setup, ...whatsapp, ...feed, ...moderation, ...community, ...info];
