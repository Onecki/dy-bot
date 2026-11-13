import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
export function setup(root = path.resolve(import.meta.dirname, '..')) {
if (process.cwd() !== root) process.chdir(root);
const writeOnce = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);
};
const karinRoot = path.resolve(path.dirname(require.resolve('node-karin')), '..');
for (const dir of ['config', 'logs', 'data', 'resource', 'temp/console', 'temp/html']) {
  fs.mkdirSync(path.join('@karinjs', dir), { recursive: true });
}
for (const file of fs.readdirSync(path.join(karinRoot, 'default/config'))) {
  writeOnce(path.join('@karinjs/config', file), fs.readFileSync(path.join(karinRoot, 'default/config', file)));
}
writeOnce('.env', [
  'HTTP_ENABLE=true', 'HTTP_HOST=127.0.0.1', 'HTTP_PORT=7777',
  `HTTP_AUTH_KEY=${randomBytes(32).toString('hex')}`,
  `WS_SERVER_AUTH_KEY=${randomBytes(32).toString('hex')}`,
  'REDIS_ENABLE=false', 'PM2_RESTART=false', 'LOG_LEVEL=info',
  'LOG_DAYS_TO_KEEP=3', 'LOG_MAX_LOG_SIZE=10485760', ''
].join('\n'));
writeOnce('config/local.json', fs.readFileSync('config/local.example.json'));
writeOnce('config/network.local.json', fs.readFileSync('config/network.example.json'));
writeOnce('config/model.local.json', fs.readFileSync('config/model.example.json'));
const bridge=JSON.parse(fs.readFileSync('config/maibot.example.json','utf8'));
bridge.token=randomBytes(32).toString('hex');
writeOnce('config/maibot.local.json',JSON.stringify(bridge,null,2)+'\n');
writeOnce('@karinjs/karin-plugin-adapter-douyin/config/config.json', JSON.stringify({accounts: [], autoReadOnMatch: false}, null, 2));
fs.mkdirSync('data',{recursive:true});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))setup();
