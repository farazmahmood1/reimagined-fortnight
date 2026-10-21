// Starts the local n8n with the NZ demo settings: npm start (from the agri-nz folder)
// n8n takes about 30 seconds to be ready (the console shows an error until its workflows are active),
// so this prints the link only once the console really answers.
import { spawn } from 'node:child_process';
import { n8nEnv, n8nBin, BASE_URL } from './env.mjs';

const CONSOLE = `${BASE_URL}/webhook/console`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Already running (for example in another window)? Say so instead of letting n8n fail with a port error.
try {
  if ((await fetch(`${BASE_URL}/healthz`)).ok) {
    console.log(`n8n is already running on ${BASE_URL}.\nOpen the demo console: ${CONSOLE}\nTo restart it, press Ctrl+C in the window where it is running, then run npm start again.`);
    process.exit(0);
  }
} catch { /* not running: carry on */ }

console.log(`Starting n8n on ${BASE_URL}. It is ready in about 30 seconds; this window says so when it is.\n`);
const child = spawn(process.execPath, [n8nBin(), 'start'], { env: n8nEnv(), stdio: 'inherit' });
let exited = false;
child.on('exit', (code) => { exited = true; process.exit(code ?? 0); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

for (let i = 0; i < 240 && !exited; i++) {
  await sleep(1000);
  try {
    if ((await fetch(CONSOLE)).status === 200) {
      console.log(`\n✓ Ready. Open the demo console: ${CONSOLE}\n  n8n editor: ${BASE_URL}  (login in LOGIN.local.txt)\n`);
      break;
    }
  } catch { /* still starting */ }
  if (i === 239) console.log(`\n! The console has not answered after 4 minutes. Check the messages above, or see data/n8n-run.log.`);
}
