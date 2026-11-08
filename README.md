# 📲 WhatsApp → Discord Bot

Spiegelt WhatsApp-Kanäle live in Discord – mit Embeds, Bildern, Videos, Dateien, Ping-Rollen, Threads, Auto-Publish, Filtern und vielen Server-Features (Moderation, AutoMod, Tickets, Giveaways, Level, Rollen-Panels, Willkommen, Logs).

## 1) Discord-Bot erstellen
1. https://discord.com/developers/applications → **New Application** → Tab **Bot** → Token kopieren.
2. Unter **Privileged Gateway Intents** aktivieren: **Server Members Intent** und **Message Content Intent**.
3. Einladen: OAuth2 → URL Generator → Scopes `bot` + `applications.commands`, Rechte: *Administrator* (am einfachsten) oder Kanäle verwalten, Webhooks verwalten, Rollen verwalten, Mitglieder kicken/bannen/timeouten, Nachrichten verwalten, Embeds, Dateien.

## 2) Auf GitHub hochladen
```bash
git init
git add .
git commit -m "WhatsApp Discord Bot"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/DEIN-REPO.git
git push -u origin main
```
(`.env` und `data/` sind per `.gitignore` ausgeschlossen – Token niemals committen.)

## 3) Auf Railway deployen
1. https://railway.com → **New Project** → **Deploy from GitHub repo** → Repo wählen.
2. **Variables** setzen: `DISCORD_TOKEN`, `OWNER_ID` (deine Discord-ID), `DATA_DIR=/data`, optional `GUILD_ID`.
3. **Wichtig:** Service → **Volumes** → **Add Volume**, Mount Path `/data`.
   Ohne Volume gehen WhatsApp-Login und alle Einstellungen bei jedem Deploy verloren.
4. Deploy abwarten – in den Logs siehst du `✅ Discord: …`.

## 4) WhatsApp verbinden (einmalig)
Auf Discord: `/whatsapp connect nummer:491701234567` → Code in WhatsApp unter *Verknüpfte Geräte → Gerät hinzufügen → Mit Telefonnummer verknüpfen* eingeben. (Alternative: `/whatsapp qr`.)

## 5) Loslegen
`/setup kanal:<WhatsApp-Kanal-Link> ziel:#news rolle:@News log:#bot-logs`

Weitere Befehle: `/help`

## Hinweise
- Nutzt die inoffizielle Bibliothek **Baileys**. Empfehlung: eine **Zweitnummer** verwenden, da WhatsApp inoffizielle Clients theoretisch sperren kann.
- Gespiegelt werden Beiträge, die ankommen, **während der Bot läuft** (keine Altbeiträge).
- Medien > 8 MB werden nicht hochgeladen (Hinweis im Embed).
