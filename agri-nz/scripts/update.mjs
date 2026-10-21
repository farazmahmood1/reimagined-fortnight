// Rebuilds the workflow files and pushes them into the RUNNING n8n, so a change in src/ shows up in seconds: npm run update
// Use "npm run setup" instead for the first install, or when the columns of a data table change.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, BASE_URL } from './env.mjs';

try { if (!(await fetch(`${BASE_URL}/healthz`)).ok) throw new Error(); } catch {
  console.error('n8n is not running. Start it with: npm start (or use npm run setup for a first install).');
  process.exit(1);
}
const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-workflows.mjs')], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

const loginFile = path.join(ROOT, 'LOGIN.local.txt');
if (!fs.existsSync(loginFile)) { console.error('LOGIN.local.txt is missing. Run: npm run setup'); process.exit(1); }
const text = fs.readFileSync(loginFile, 'utf8');
const email = (text.match(/Email: (\S+)/) || [])[1];
const password = (text.match(/Password: (\S+)/) || [])[1];
const login = await fetch(`${BASE_URL}/rest/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emailOrLdapLoginId: email, password }) });
if (!login.ok) { console.error(`Could not sign in to n8n (HTTP ${login.status}). Is the password in LOGIN.local.txt still current?`); process.exit(1); }
const cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
const api = async (method, route, body) => {
  const res = await fetch(`${BASE_URL}/rest${route}`, { method, headers: { cookie, 'content-type': 'application/json', 'browser-id': 'agri-update-script' }, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text();
  let json; try { json = JSON.parse(raw); } catch { json = raw; }
  return { status: res.status, data: json?.data ?? json, raw };
};

// The shared workflows go first, because the others call them.
const files = fs.readdirSync(path.join(ROOT, 'workflows')).filter((f) => f.endsWith('.json')).sort((a, b) => (/LoadData|SendMessage/.test(b) ? 1 : 0) - (/LoadData|SendMessage/.test(a) ? 1 : 0));
let failed = 0;
for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', f), 'utf8'));
  const current = await api('GET', `/workflows/${wf.id}`);
  if (current.status !== 200) { console.error(`! ${wf.id}: not found in n8n (HTTP ${current.status}). Run npm run setup.`); failed++; continue; }
  const saved = await api('PATCH', `/workflows/${wf.id}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings, versionId: current.data.versionId });
  if (saved.status !== 200) { console.error(`! ${wf.id}: save failed (HTTP ${saved.status}) ${saved.raw.slice(0, 200)}`); failed++; continue; }
  const published = await api('POST', `/workflows/${wf.id}/activate`, { versionId: saved.data.versionId });
  if (published.status !== 200) { console.error(`! ${wf.id}: publish failed (HTTP ${published.status}) ${published.raw.slice(0, 200)}`); failed++; continue; }
  console.log(`✓ Updated ${wf.name}`);
}
console.log(failed ? `\n${failed} workflow(s) did not update.` : '\nAll workflows updated and published. Reload the console.');
process.exit(failed ? 1 : 0);
