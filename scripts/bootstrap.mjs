import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ProxyAgent} from 'undici';
import {setup} from './setup.mjs';
import {pythonEnv} from '../lib/python.mjs';
setup();
if(process.argv.includes('--help')){
  console.log('pnpm bootstrap [--python Python可执行文件]\n下载校验固定版 MaiBot，安装独立环境并应用兼容补丁；不会同意条款、登录或发送消息。');
  process.exit(0);
}
const pinned=JSON.parse(fs.readFileSync('config/maibot-version.json','utf8'));
const index=process.argv.indexOf('--python');
const candidates=index>=0?[process.argv[index+1]]:[process.env.DYBOT_PYTHON,'python','python3','py'].filter(Boolean);
const python=candidates.find(file=>spawnSync(file,['-c','import sys;sys.exit(0 if sys.version_info >= (3,12) else 1)'],{env:pythonEnv(),stdio:'ignore',windowsHide:true}).status===0);
if(!python)throw Error('需要 Python 3.12+，可用 pnpm bootstrap --python 绝对路径 指定');
fs.mkdirSync('.tools',{recursive:true});
const archive=path.resolve(`.tools/maibot-${pinned.version}.tar.gz`);
if(!fs.existsSync('maibot/pyproject.toml')){
  if(!fs.existsSync(archive)){
    const network=JSON.parse(fs.readFileSync('config/network.local.json','utf8'));
    const dispatcher=network.geminiProxyUrl?new ProxyAgent(network.geminiProxyUrl):undefined;
    try{
      const response=await fetch(pinned.archiveUrl,{...(dispatcher?{dispatcher}:{}),signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw Error(`MaiBot 下载失败：HTTP ${response.status}`);
      const buffer=Buffer.from(await response.arrayBuffer());
      if(createHash('sha256').update(buffer).digest('hex')!==pinned.archiveSha256)throw Error('MaiBot 源码包校验失败');
      fs.writeFileSync(archive,buffer);
    }finally{await dispatcher?.close();}
  }
}
const result=spawnSync(python,['scripts/bootstrap-maibot.py',archive],{env:pythonEnv(),stdio:'inherit',windowsHide:true});
process.exitCode=result.status ?? 1;
