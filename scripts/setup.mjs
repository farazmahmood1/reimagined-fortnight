// One-time setup:   npm run setup          (n8n must be stopped; setup starts and stops it)
// Reset demo data:  npm run reset-demo     (n8n must be running)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, BASE_URL, n8nEnv, n8nBin } from './env.mjs';

const args = new Set(process.argv.slice(2));
const LOGIN_FILE = path.join(ROOT, 'LOGIN.local.txt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp() {
  try { return (await fetch(`${BASE_URL}/healthz`)).ok; } catch { return false; }
}
// n8n answers /healthz before its REST routes and webhooks are ready, so wait for the settings route.
async function settings() {
  try {
    const res = await fetch(`${BASE_URL}/rest/settings`);
    return res.ok ? (await res.json()).data : null;
  } catch { return null; }
}
async function waitUntilReady(seconds = 180) {
  for (let i = 0; i < seconds; i++) { const s = await settings(); if (s) return s; await sleep(1000); }
  return null;
}
async function resetDemoData() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const res = await fetch(`${BASE_URL}/webhook/console/run`, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'run=reset',
    });
    if (res.status === 303) { console.log('✓ Demo data loaded (Monday-morning starting point)'); return; }
    if (res.status !== 404) throw new Error(`Reset failed: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`);
    await sleep(2000); // webhook not registered yet
  }
  throw new Error('Reset failed: the console webhook never became available. Are the workflows published?');
}

if (args.has('--reset')) {
  if (!(await isUp())) { console.error('n8n is not running. Start it with: npm start'); process.exit(1); }
  await resetDemoData();
  process.exit(0);
}

if (await isUp()) {
  console.error('n8n is running. Stop it first (Ctrl+C in its window), then run: npm run setup');
  process.exit(1);
}

// 1. Generate workflow files from src/
console.log('Building workflows…');
let r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-workflows.mjs')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

// 2. Import them into n8n and publish (activate) each one
console.log('Importing workflows into n8n…');
r = spawnSync(process.execPath, [n8nBin(), 'import:workflow', '--separate', `--input=${path.join(ROOT, 'workflows')}`],
  { env: n8nEnv(), stdio: ['ignore', 'pipe', 'inherit'] });
if (r.status !== 0) process.exit(r.status ?? 1);
for (const f of fs.readdirSync(path.join(ROOT, 'workflows')).filter((x) => x.endsWith('.json'))) {
  const id = path.basename(f, '.json');
  const p = spawnSync(process.execPath, [n8nBin(), 'publish:workflow', `--id=${id}`], { env: n8nEnv(), encoding: 'utf8' });
  console.log(p.status === 0 ? `✓ Published ${id}` : `! Could not publish ${id}: ${(p.stderr || p.stdout).trim().split('\n').pop()}`);
}

// 3. Start n8n
console.log('Starting n8n…');
const server = spawn(process.execPath, [n8nBin(), 'start'], { env: n8nEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
const log = fs.createWriteStream(path.join(ROOT, 'data', 'setup-n8n.log'));
server.stdout.pipe(log);
server.stderr.pipe(log);
const ready = await waitUntilReady();
if (!ready) { console.error('n8n did not start; see data/setup-n8n.log'); server.kill(); process.exit(1); }

// 4. Owner login for the n8n editor (local only; written to LOGIN.local.txt, never printed)
const needsOwner = ready.userManagement?.showSetupOnFirstLoad;
if (needsOwner) {
  const password = `Frf-${crypto.randomBytes(12).toString('base64url')}9a`;
  const email = 'demo@forrof.local';
  const res = await fetch(`${BASE_URL}/rest/owner/setup`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, firstName: 'Forrof', lastName: 'Demo', password }),
  });
  if (!res.ok) console.error(`! Owner setup failed (HTTP ${res.status}). Create the owner in the browser at ${BASE_URL}`);
  else {
    fs.writeFileSync(LOGIN_FILE, `n8n editor: ${BASE_URL}\nEmail: ${email}\nPassword: ${password}\n\nLocal demo login. Change it in n8n (Settings → Personal) if you like. Do not share or commit this file.\n`);
    console.log('✓ n8n login created → LOGIN.local.txt');
  }
} else {
  console.log('✓ n8n login already exists (see LOGIN.local.txt)');
}

// 5. Load demo data (stop n8n cleanly even if this fails)
try {
  await resetDemoData();
} catch (err) {
  console.error(err.message);
  server.kill('SIGINT');
  await new Promise((resolve) => server.once('exit', resolve));
  process.exit(1);
}

server.kill('SIGINT');
await new Promise((resolve) => server.once('exit', resolve));
console.log(`\nSetup finished. Start the demo with: npm start\n  Demo console: ${BASE_URL}/webhook/console\n  n8n editor:   ${BASE_URL}  (login in LOGIN.local.txt)\n`);
