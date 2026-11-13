import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {pythonPath,pythonEnv} from './python.mjs';

export async function startMaiBot() {
  const root=path.resolve('maibot');
  const config=JSON.parse(fs.readFileSync('config/maibot.local.json','utf8'));
  const url=new URL(config.url);
  if(!config.accountId || !config.token || !['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('请先完成 pnpm setup:local、pnpm login:douyin、pnpm bootstrap 和本地配置');
  const ready=()=>new Promise(resolve=>{const socket=net.connect({host:url.hostname,port:Number(url.port)});socket.setTimeout(500);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.once('timeout',()=>{socket.destroy();resolve(false);});});
  if(await ready()){console.info('[dybot] 使用已启动的 MaiBot');return;}
  // 后端可能正在自行重启；已记录的进程仍在时等待，避免重复拉起两个实例。
  const runtimeFile='data/maibot-runtime.json';
  if(fs.existsSync(runtimeFile)){
    const running=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));
    let alive=false;
    try{process.kill(running.pid,0);alive=true;}catch(error){alive=error.code==='EPERM';}
    if(alive){
      const end=Date.now()+90000;
      while(Date.now()<end){if(await ready()){console.info('[dybot] MaiBot 后端已恢复');return;}await new Promise(resolve=>setTimeout(resolve,500));}
      throw Error('记录的 MaiBot 进程仍在，但消息端口未恢复，请检查后台日志');
    }
  }
  for(const [source,confirmation] of [['EULA.md','eula.confirmed'],['PRIVACY.md','privacy.confirmed']]){
    const hash=createHash('md5').update(fs.readFileSync(path.join(root,source),'utf8')).digest('hex');
    const file=path.join(root,confirmation);
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==hash)throw Error('MaiBot 协议尚未确认或已更新，请先执行 pnpm maibot 并自行阅读、确认条款');
  }
  const env=pythonEnv();
  const stamp=Date.now(),stdout=path.resolve(`data/maibot-${stamp}.stdout.log`),stderr=path.resolve(`data/maibot-${stamp}.stderr.log`);
  const out=fs.openSync(stdout,'a'),err=fs.openSync(stderr,'a');
  const child=spawn(pythonPath(root),['bot.py'],{cwd:root,env,detached:true,windowsHide:true,stdio:['ignore',out,err]});
  child.unref();
  fs.closeSync(out);fs.closeSync(err);
  let launchError;
  child.on('error',error=>{launchError=error;});
  fs.writeFileSync('data/maibot-runtime.json',JSON.stringify({pid:child.pid,stdout,stderr,startedAt:new Date().toISOString()},null,2));
  const end=Date.now()+90000;
  while(Date.now()<end){
    if(launchError)throw launchError;
    if(child.exitCode!==null)throw Error('MaiBot 启动失败，检查 data/maibot-runtime.json 指向的日志');
    if(await ready()){console.info('[dybot] MaiBot 消息服务已就绪');return;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  child.kill();throw Error('MaiBot 启动超过90秒，请检查日志');
}
