// Starts the local n8n with the demo settings: npm start
import { spawn } from 'node:child_process';
import { n8nEnv, n8nBin, BASE_URL } from './env.mjs';

console.log(`Starting n8n on ${BASE_URL}`);
console.log(`Demo console: ${BASE_URL}/webhook/console\n`);
const child = spawn(process.execPath, [n8nBin(), 'start'], { env: n8nEnv(), stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
