import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {setup} from '../scripts/setup.mjs';

test('首次初始化生成空白私有配置和随机令牌，重复执行不覆盖已有配置',()=>{
  const original=process.cwd();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dybot-setup-'));
  fs.mkdirSync(path.join(root,'config'));
  for(const name of ['local','model','network','maibot'])fs.copyFileSync(path.join(original,`config/${name}.example.json`),path.join(root,`config/${name}.example.json`));
  try{
    setup(root);
    const read=name=>JSON.parse(fs.readFileSync(`config/${name}.local.json`,'utf8'));
    assert.equal(JSON.parse(fs.readFileSync('config/local.json')).enabled,false);
    assert.equal(read('model').apiKey,'');
    assert.equal(read('maibot').accountId,'');
    assert.match(read('maibot').token,/^[a-f0-9]{64}$/);
    const before=fs.readFileSync('config/maibot.local.json','utf8');
    const environment=fs.readFileSync('.env','utf8');
    setup(root);
    assert.equal(fs.readFileSync('config/maibot.local.json','utf8'),before);
    assert.equal(fs.readFileSync('.env','utf8'),environment);
  }finally{process.chdir(original);}
});
