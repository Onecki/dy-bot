import fs from 'node:fs';
import {hooks,getAllBot,contactGroup,segment,logger} from 'node-karin';
import {MaiBotBridge} from './maibot-client.mjs';
import {toMaiMessage} from './maibot-protocol.mjs';
import {createQuoteResolver} from './quote.mjs';
const readConfig=()=>({local:JSON.parse(fs.readFileSync('config/local.json','utf8')),bridge:JSON.parse(fs.readFileSync('config/maibot.local.json','utf8'))});
const quotes=createQuoteResolver();
const bridge=new MaiBotBridge({readConfig,log:text=>logger.info('[dybot] '+text),sendText:async(account,group,text)=>{
  const bot=getAllBot().find(b=>b.adapter.name==='douyin'&&String(b.selfId)===account);
  if(!bot)throw Error('抖音账号不在线');
  return bot.sendMsg(contactGroup(group),[segment.text(text)]);
}});
globalThis[Symbol.for('dybot.maibot')]=bridge;
bridge.start();
let inbound=Promise.resolve();
hooks.message(async(e,next)=>{
  if(!String(e.bot?.adapter?.name).toLowerCase().includes('douyin'))return next();
  // 本钩子消费所有抖音消息，只交给 MaiBot 处理。
  inbound=inbound.then(async()=>{
    const cfg=readConfig();
    const message=toMaiMessage(e,cfg.bridge,cfg.local);
    if(!message)return;
    quotes.remember(e);
    const quoted=await quotes.resolve(e,cfg.local);
    bridge.forward(quoted?.text?toMaiMessage(e,cfg.bridge,cfg.local,quoted):message);
  }).catch(()=>logger.warn('[dybot] MaiBot 入站转发失败'));
  await inbound;
},{priority:-100000});
