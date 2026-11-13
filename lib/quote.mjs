const groupKey = e => JSON.stringify([String(e.selfId), String(e.groupId || e.contact?.peer)]);
const textOf = message => (message?.elements || []).filter(x => x.type === 'text').map(x => x.text || '').join('').trim().slice(0, 2000);
export function createQuoteResolver() {
  const cache = new Map();
  function remember(e, now = Date.now()) {
    for (const [key, row] of cache) if (now - row.time > 900000) cache.delete(key);
    if (!e.messageId || !textOf(e)) return;
    cache.set(`${groupKey(e)}:${e.messageId}`, {time:now, userId:String(e.sender?.userId || ''), name:e.sender?.card || e.sender?.name || e.sender?.nick || '', text:textOf(e)});
    while (cache.size > 300) cache.delete(cache.keys().next().value);
  }
  return {
    remember,
    async resolve(e, cfg) {
      if (!cfg.quote?.enabled || !e.replyId) return null;
      const cached = cache.get(`${groupKey(e)}:${e.replyId}`);
      if (cached && Date.now() - cached.time < 900000) return cached;
      let timer;
      try {
        const message = await Promise.race([
          Promise.resolve().then(() => e.bot.getMsg(e.contact, e.replyId)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(Error('quote timeout')), 3000); })
        ]);
        if (!textOf(message)) return {unavailable:true};
        const result = {text:textOf(message), userId:String(message.sender?.userId || ''), name:message.sender?.card || message.sender?.name || message.sender?.nick || ''};
        return result;
      } catch { return {unavailable:true}; }
      finally { clearTimeout(timer); }
    }
  };
}
