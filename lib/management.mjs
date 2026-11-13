import fs from 'node:fs';
import { getAllBot, app } from 'node-karin';

app.get('/dybot/health', (_req, res) => {
  const settings = JSON.parse(fs.readFileSync('config/local.json', 'utf8'));
  const bots = getAllBot().filter(bot => bot.adapter.name === 'douyin').map(bot => {
    let connected = false;
    try { connected = Boolean(bot.ctx.bot.im().ws.connected); } catch {}
    return { selfId: bot.selfId, connected };
  });
  const bridge=globalThis[Symbol.for('dybot.maibot')];
  res.json({ engine:'maibot', enabled: settings.enabled, allowedGroups: settings.allowedGroups, maibot:bridge?.status || {connected:false}, bots });
});
