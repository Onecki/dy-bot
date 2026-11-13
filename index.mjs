import {setup} from './scripts/setup.mjs';
import {startMaiBot} from './lib/maibot-launcher.mjs';
setup();
await startMaiBot();
await import('./lib/maibot-runtime.mjs');
await import('./lib/management.mjs');
const { start } = await import('node-karin');
await start();
