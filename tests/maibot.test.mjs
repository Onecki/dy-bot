import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {toMaiMessage,outgoingMessage} from '../lib/maibot-protocol.mjs';
import {MaiBotBridge} from '../lib/maibot-client.mjs';
const bridge={platform:'douyin',accountId:'9000000000000001',groupNames:{'9000000000000000001':'测试群'},observeOnly:false,sendCooldownSeconds:0,maxOutboundAgeSeconds:120};
const local={enabled:true,allowedGroups:['9000000000000000001'],maxInputChars:2000,maxReplyChars:600,maxRepliesPerDay:2};
const event={selfId:bridge.accountId,isGroup:true,groupId:local.allowedGroups[0],sender:{userId:'9000000000000002',name:'群友'},messageId:'9000000000000000099',elements:[{type:'at',targetId:bridge.accountId},{type:'text',text:'普通群聊也会转发'}]};
const outgoing=(id='out1')=>({message_info:{platform:'douyin',message_id:id,time:Date.now()/1000,group_info:{group_id:event.groupId},additional_config:{platform_io_account_id:bridge.accountId}},message_segment:{type:'seglist',data:[{type:'text',data:'你好'},{type:'seglist',data:[{type:'text',data:'呀'}]}]}});
test('转换普通文字、真实@和引用，长ID保持字符串，过滤其他群和自身',()=>{
  const m=toMaiMessage(event,bridge,local,{name:'甲',userId:'u1',text:'周日见'});
  assert.equal(m.message_info.group_info.group_id,'9000000000000000001');
  assert.equal(m.message_info.message_id,event.messageId);
  assert.equal(m.message_info.group_info.group_name,'测试群');
  assert(m.message_segment.data.some(s=>s.type==='at'&&s.data===bridge.accountId));
  assert(JSON.stringify(m).includes('周日见'));
  assert.equal(toMaiMessage({...event,groupId:'other'},bridge,local),null);
  assert.equal(toMaiMessage({...event,sender:{userId:bridge.accountId}},bridge,local),null);
});
test('出站只允许本账号目标群、新鲜文字且非观察模式',()=>{
  assert.equal(outgoingMessage(outgoing(),bridge,local).text,'你好呀');
  assert.equal(outgoingMessage(outgoing(),{...bridge,observeOnly:true},local),null);
  assert.equal(outgoingMessage(outgoing(),bridge,{...local,enabled:false}),null);
  const old=outgoing();old.message_info.time-=121;assert.equal(outgoingMessage(old,bridge,local),null);
  const other=outgoing();other.message_info.additional_config.platform_io_account_id='another';assert.equal(outgoingMessage(other,bridge,local),null);
  other.message_info.group_info.group_id='other';assert.equal(outgoingMessage(other,bridge,local),null);
});
test('出站去重和每日发送预算跨重启保存；关闭后不会发送',async()=>{
  const statePath=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'dybot-mai-')),'delivery.json');
  const sent=[];const readConfig=()=>({bridge,local});
  const sendText=async(...args)=>{sent.push(args);return {messageId:'actual'};};
  const a=new MaiBotBridge({readConfig,sendText,statePath});
  await a.deliver(outgoing('1'));await a.deliver(outgoing('1'));
  const b=new MaiBotBridge({readConfig,sendText,statePath});
  await b.deliver(outgoing('1'));await b.deliver(outgoing('2'));await b.deliver(outgoing('3'));
  assert.equal(sent.length,2);assert.equal(sent[0][1],event.groupId);
});
