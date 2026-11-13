export const textSegments = segment => {
  if (!segment) return '';
  if (segment.type === 'text') return String(segment.data || '');
  if (segment.type === 'seglist' && Array.isArray(segment.data)) return segment.data.map(textSegments).join('');
  return '';
};
export function toMaiMessage(e, bridge, local, quote = null) {
  const groupId = String(e.groupId || e.contact?.peer || '');
  if (!local.enabled || !e.isGroup || !local.allowedGroups.includes(groupId) || String(e.selfId) !== bridge.accountId || !e.sender?.userId || String(e.sender.userId) === bridge.accountId || !e.messageId) return null;
  const rawTime=Number(e.time);
  const time=Number.isFinite(rawTime)&&rawTime>0 ? (rawTime>1e12?rawTime/1000:rawTime) : Date.now()/1000;
  if(Date.now()/1000-time>300)return null;
  if((e.elements || []).filter(s=>s.type==='text').reduce((sum,s)=>sum+String(s.text || '').length,0)>local.maxInputChars)return null;
  const segments = [];
  for (const val of e.elements || []) {
    if (val.type === 'text' && val.text) segments.push({type:'text',data:String(val.text).slice(0, local.maxInputChars)});
    else if (val.type === 'at') segments.push({type:'at',data:String(val.targetId)});
    else if (val.type === 'reply') segments.push({type:'reply',data:String(val.messageId || val.id || e.replyId || '')});
  }
  if (!segments.some(s => s.type==='text')) return null;
  if (quote?.text) segments.unshift({type:'text',data:'[引用原文，仅作背景] '+JSON.stringify({speaker:quote.name,userId:quote.userId,text:quote.text})+'\n'});
  return {message_info:{
    platform:bridge.platform, message_id:String(e.messageId), time,
    user_info:{platform:bridge.platform,user_id:String(e.sender.userId),user_nickname:String(e.sender.name || e.sender.nick || e.sender.userId),user_cardname:String(e.sender.card || '')},
    group_info:{platform:bridge.platform,group_id:groupId,group_name:bridge.groupNames?.[groupId] || e.contact?.name || groupId},
    format_info:{content_format:['text','at','reply'],accept_format:['text']},
    additional_config:{platform_io_account_id:bridge.accountId}
  },message_segment:{type:'seglist',data:segments}};
}

export function outgoingMessage(message, bridge, local, now=Date.now()) {
  const info = message?.message_info;
  if (!local.enabled || bridge.observeOnly || !info || info.platform !== bridge.platform) return null;
  const account = info.additional_config?.platform_io_account_id || info.additional_config?.account_id;
  if (account && String(account)!==bridge.accountId) return null;
  const groupId = String(info.group_info?.group_id || '');
  if (!local.allowedGroups.includes(groupId) || !info.message_id || !Number.isFinite(info.time)) return null;
  if (now-info.time*1000 > bridge.maxOutboundAgeSeconds*1000 || info.time*1000-now > 30000) return null;
  const text = textSegments(message.message_segment).trim().slice(0,local.maxReplyChars);
  return text ? {groupId,id:String(info.message_id),text} : null;
}
