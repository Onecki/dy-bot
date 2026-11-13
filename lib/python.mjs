import path from 'node:path';
import fs from 'node:fs';
export const pythonPath=(root=path.resolve('maibot'))=>path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
export function pythonEnv(){
  const env={...process.env,PYTHONUTF8:'1',PYTHONUNBUFFERED:'1',NO_PROXY:'127.0.0.1,localhost,::1'};
  if(fs.existsSync('config/network.local.json')){
    const {geminiProxyUrl}=JSON.parse(fs.readFileSync('config/network.local.json','utf8'));
    if(geminiProxyUrl)env.HTTP_PROXY=env.HTTPS_PROXY=geminiProxyUrl;
  }
  return env;
}
