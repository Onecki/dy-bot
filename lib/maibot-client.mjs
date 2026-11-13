import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import {outgoingMessage} from './maibot-protocol.mjs';
export {WebSocket};

export class MaiBotBridge {
  constructor({readConfig, sendText, log=()=>{}, statePath='data/maibot-delivery.json'}) {
    this.readConfig=readConfig;this.sendText=sendText;this.log=log;this.statePath=statePath;
    this.ws=null;this.timer=null;this.closed=false;this.seenInput=new Map();this.lastSent=new Map();this.tail=Promise.resolve();
    this.status={connected:false,forwarded:0,sent:0,dropped:0};
    this.delivery={day:'',count:0,ids:[]};
    if (fs.existsSync(statePath)) this.delivery=JSON.parse(fs.readFileSync(statePath,'utf8'));
  }
  start() {
    if (this.closed || this.ws) return;
    const {bridge}=this.readConfig();
    const url=new URL(bridge.url);
    if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.protocol!=='ws:') throw Error('MaiBot 桥接只允许本机 WebSocket');
    const ws=this.ws=new WebSocket(bridge.url,{headers:{platform:bridge.platform,authorization:bridge.token},handshakeTimeout:5000,maxPayload:1024*1024});
    ws.on('open',()=>{this.status.connected=true;this.log('MaiBot WebSocket 已连接');});
    ws.on('message',data=>{
      this.tail=this.tail.then(async()=>{
        let message;try{message=JSON.parse(data.toString());}catch{return;}
        await this.deliver(message);
      }).catch(()=>this.log('MaiBot 出站处理失败，未自动重发'));
    });
    ws.on('error',()=>{});
    ws.on('close',()=>{this.status.connected=false;this.ws=null;if(!this.closed)this.timer=setTimeout(()=>this.start(),5000);});
  }
  forward(message) {
    if (!message) return false;
    const now=Date.now();
    for (const [id,time] of this.seenInput) if(now-time>600000)this.seenInput.delete(id);
    const id=message.message_info.message_id;
    if(this.seenInput.has(id))return false;
    this.seenInput.set(id,now);
    if(this.ws?.readyState!==WebSocket.OPEN){this.status.dropped++;return false;}
    this.ws.send(JSON.stringify(message));this.status.forwarded++;return true;
  }
  async deliver(message) {
    const {bridge,local}=this.readConfig();
    const output=outgoingMessage(message,bridge,local);
    if(!output)return;
    const now=Date.now(),day=new Date(now+8*3600000).toISOString().slice(0,10);
    if(this.delivery.day!==day)this.delivery={day,count:0,ids:[]};
    const key=`${bridge.accountId}:${output.groupId}:${output.id}`;
    if(this.delivery.ids.includes(key) || this.delivery.count>=local.maxRepliesPerDay || now-(this.lastSent.get(output.groupId)||0)<bridge.sendCooldownSeconds*1000)return;
    // 发送前落盘预留；失败也不盲目重发，防止平台实际已接收时重复发言。
    this.delivery.ids.push(key);this.delivery.ids=this.delivery.ids.slice(-1000);this.delivery.count++;
    fs.mkdirSync(path.dirname(this.statePath),{recursive:true});fs.writeFileSync(this.statePath,JSON.stringify(this.delivery));
    this.lastSent.set(output.groupId,now);
    const result=await this.sendText(bridge.accountId,output.groupId,output.text);
    this.status.sent++;this.log('MaiBot 回复已提交抖音发送接口');
    if(result?.messageId && this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({platform:bridge.platform,message_type_name:'message_id_echo',is_custom_message:true,content:{type:'echo',echo:output.id,actual_id:String(result.messageId)},timestamp:Date.now()/1000}));
  }
  close(){this.closed=true;clearTimeout(this.timer);this.ws?.close();}
}
