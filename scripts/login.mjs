import fs from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import QRCode from 'qrcode';
import {login,Bot} from 'douyin-login-sdk';
import {setup} from './setup.mjs';
setup();
if(process.argv.includes('--help')){
  console.log('pnpm login:douyin：扫码并保存抖音会话，显示可选群的名称和ID。登录前请停止网关；不会自动选群或启用群回复。');
  process.exit(0);
}
const quiet={info(){},debug(){},warn(){},error(){}};
let bot;
try{
  const session=await login({log:quiet,onQr:async qr=>{
    const file=path.resolve('data/douyin-login.png');
    await QRCode.toFile(file,qr.url,{width:480,margin:4});
    console.log('请用抖音 App 扫描本机图片：'+file);
  },onStatus:status=>console.log('登录状态：'+status),onVerifyUrl:url=>console.log('请在本机打开验证页面（勿分享链接）：'+url),onMfa:async info=>{
    if(info.kind==='password')throw Error('请先在抖音 App 完成安全验证后重试；本脚本不接收账户密码');
    const terminal=createInterface({input:process.stdin,output:process.stdout});
    try{return await terminal.question('请在本机输入短信验证码：');}finally{terminal.close();}
  }});
  if(!/^\d+$/.test(session.userId))throw Error('平台返回的账号ID无效');
  const folder=path.join('@karinjs/karin-plugin-adapter-douyin/data/accounts',session.userId);
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'session.json'),JSON.stringify({platformUid:session.userId,cookie:session.cookie,userData:session.userData,screenName:session.userData?.screen_name,device:session.device,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},null,2));
  const cfgFile='config/maibot.local.json';
  const cfg=JSON.parse(fs.readFileSync(cfgFile,'utf8'));
  if(!cfg.accountId){cfg.accountId=session.userId;fs.writeFileSync(cfgFile,JSON.stringify(cfg,null,2)+'\n');}
  console.log('登录成功，账号ID：'+session.userId+'。会话仅保存在已忽略的本地目录。');
  bot=new Bot({cookie:session.cookie,userId:session.userId,device:session.device,log:quiet});
  await bot.start();
  const groups=await bot.grp.list();
  console.table(groups.map(group=>({name:group.name,id:group.conversationShortId || group.conversationId})));
  console.log('将目标群ID填入 config/local.json 的 allowedGroups，群名填入 config/maibot.local.json 的 groupNames。');
}catch{
  console.error('登录或群列表读取未完成。请在抖音 App 检查登录/安全验证状态后重试。已保存的会话不会输出到终端。');
  process.exitCode=1;
}finally{bot?.stop();}
