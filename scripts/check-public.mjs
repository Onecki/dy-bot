import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dybot-public-audit-'));
const gitDir=fs.existsSync(path.join(root,'.git'))?path.join(root,'.git'):path.join(temp,'audit.git');
if(!fs.existsSync(gitDir)){
  const initialized=spawnSync('git',['init','--bare',gitDir],{stdio:'ignore',windowsHide:true});
  if(initialized.status!==0)throw Error('检查公开文件需要 Git');
}
const result=spawnSync('git',[`--git-dir=${gitDir}`,`--work-tree=${root}`,'ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error('无法获取 Git 待发布文件列表');
const files=[...new Set(result.stdout.split('\0').filter(Boolean))];
const privatePaths=/^(?:node_modules|maibot|@karinjs|data|\.tools|\.research|\.pnpm-store|logs)\/|(?:^|\/)\.env(?:\.|$)|\.local\.json$|^config\/local\.json$|(?:^|\/)(?:session(?:\.previous)?\.json|webui\.json|eula\.confirmed|privacy\.confirmed)$|\.(?:pem|key|log|tgz|zip)$/;
const rules=[/AIza[A-Za-z0-9_-]{25,}/,/AQ\.[A-Za-z0-9_-]{25,}/,/sk-[A-Za-z0-9_-]{24,}/,/(?:sessionid|sid_guard|passport_csrf_token)=[A-Za-z0-9%_-]{12,}/i,/[A-Za-z]:[\\/]Users[\\/][^\s\\/]+[\\/]/];
const privateValues=[];
const readJson=file=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8')):{};
const model=readJson('config/model.local.json');
const bridge=readJson('config/maibot.local.json');
const local=readJson('config/local.json');
const webui=readJson('maibot/data/webui.json');
for(const value of [model.apiKey,bridge.token,bridge.accountId,webui.access_token,...(local.allowedGroups || []),...Object.keys(bridge.groupNames || {}),...Object.values(bridge.groupNames || {})])if(typeof value==='string'&&value.length>=4)privateValues.push(value);
if(fs.existsSync(path.join(root,'.env'))){
  const env=fs.readFileSync(path.join(root,'.env'),'utf8');
  for(const line of env.split(/\r?\n/))if(/(?:AUTH_KEY|TOKEN|SECRET|PASSWORD)=/.test(line)){
    const value=line.slice(line.indexOf('=')+1).trim();if(value.length>=8)privateValues.push(value);
  }
}
const failures=[];
for(const file of files){
  if(privatePaths.test(file)){failures.push({file,reason:'私有或运行时文件将进入提交'});continue;}
  const absolute=path.join(root,file);
  if(fs.existsSync(absolute)&&fs.lstatSync(absolute).isSymbolicLink()){failures.push({file,reason:'公开源码不应包含指向本机文件的链接'});continue;}
  if(!fs.existsSync(absolute)||!fs.statSync(absolute).isFile())continue;
  if(fs.statSync(absolute).size>2*1024*1024){failures.push({file,reason:'异常大文件，请人工检查'});continue;}
  const text=fs.readFileSync(absolute,'utf8');
  if(rules.some(rule=>rule.test(text))||privateValues.some(value=>text.includes(value)))failures.push({file,reason:'疑似凭据、个人标识或本机路径'});
}
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exitCode=1;}
else console.log(JSON.stringify({ok:true,publicFiles:files.length,note:'依据当前 Git 文件列表/忽略规则检查；未上传任何文件，也不能替代人工审查或旧提交历史扫描。'},null,2));
if(process.argv.includes('--list'))for(const file of files)console.log(file);
