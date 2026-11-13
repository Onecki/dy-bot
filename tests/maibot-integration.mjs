import {spawn} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {MaiBotBridge} from '../lib/maibot-client.mjs';
import {toMaiMessage} from '../lib/maibot-protocol.mjs';
import {pythonPath} from '../lib/python.mjs';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const child=spawn(pythonPath(),['tests/maibot-protocol-server.py',String(port)],{cwd:root,env:{...process.env,PYTHONUTF8:'1'},windowsHide:true});
let output='';child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
const until=async predicate=>{const end=Date.now()+15000;while(!predicate()){if(Date.now()>end)throw Error('integration timeout: '+output.slice(-1200));await new Promise(r=>setTimeout(r,50));}};
const local={enabled:true,allowedGroups:['9000000000000000001'],maxInputChars:2000,maxReplyChars:600,maxRepliesPerDay:10};
const config={url:`ws://127.0.0.1:${port}/ws`,token:'integration-test-token',platform:'douyin',accountId:'9000000000000001',observeOnly:false,sendCooldownSeconds:0,maxOutboundAgeSeconds:120};
const statePath=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'dybot-protocol-')),'state.json');
const sent=[];
const bridge=new MaiBotBridge({readConfig:()=>({local,bridge:config}),statePath,sendText:async(...args)=>{sent.push(args);return {messageId:'douyin-real-id'};}});
try {
  await until(()=>output.includes('Uvicorn running'));
  bridge.start();await until(()=>bridge.status.connected);
  const event={selfId:config.accountId,groupId:local.allowedGroups[0],isGroup:true,messageId:'9000000000000000099',sender:{userId:'u1',name:'测试群友'},elements:[{type:'text',text:'你好'}]};
  assert(bridge.forward(toMaiMessage(event,config,local)));
  assert(!bridge.forward(toMaiMessage(event,config,local)));
  await until(()=>output.includes('ECHO_PASS'));
  assert.equal(sent.length,1);assert.equal(sent[0][2],'官方协议联调通过');
  console.log('MAIBOT PROTOCOL PASS: 真实 maim-message 鉴权、入站解析、出站文字、群路由、去重、真实ID回执');
} finally {bridge.close();child.kill();}
