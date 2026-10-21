// Shared settings for running the NZ agribusiness demo on a local n8n. Used by start, setup, build and test scripts.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// n8n is installed once, in the folder above (the recruitment demo). This demo reuses that copy
// with its own data folder, login, port and task-runner port, so both demos can run side by side.
export const N8N_HOME = path.resolve(ROOT, '..');
export const PORT = 5680;
export const BROKER_PORT = 5681; // n8n's task runner broker; the recruitment demo uses the default, 5679
export const BASE_URL = `http://localhost:${PORT}`;
export const DATA_DIR = path.join(ROOT, 'data');
export const FILES_DIR = path.join(ROOT, 'files');
export const DEMO_FILES_DIR = path.join(ROOT, 'demo-files');

for (const dir of [DATA_DIR, FILES_DIR, path.join(FILES_DIR, 'evidence'), path.join(FILES_DIR, 'register'), path.join(FILES_DIR, 'payment-runs')]) {
  fs.mkdirSync(dir, { recursive: true });
}
// Placeholder files the seeded demo records point at. Copied once, never overwritten.
for (const [file, folder] of [['seed-sample-evidence.pdf', 'evidence'], ['seed-sample-certificate.pdf', 'register']]) {
  const from = path.join(DEMO_FILES_DIR, file);
  const to = path.join(FILES_DIR, folder, file);
  if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
}

export function n8nEnv() {
  return {
    ...process.env,
    N8N_USER_FOLDER: DATA_DIR,
    N8N_PORT: String(PORT),
    N8N_HOST: 'localhost',
    N8N_PROTOCOL: 'http',
    N8N_LISTEN_ADDRESS: '127.0.0.1',
    N8N_WEBHOOK_URL: `${BASE_URL}/`,
    N8N_RUNNERS_BROKER_PORT: String(BROKER_PORT),
    // JavaScript only (no Python runner needed for this demo).
    N8N_PYTHON_ENABLED: 'false',
    N8N_RUNNERS_TASK_TIMEOUT: '60',
    N8N_EDITOR_BASE_URL: `${BASE_URL}/`,
    GENERIC_TIMEZONE: 'Pacific/Auckland',
    TZ: 'Pacific/Auckland',
    // Privacy: no telemetry, no update pings from the demo machine.
    N8N_DIAGNOSTICS_ENABLED: 'false',
    N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_PERSONALIZATION_ENABLED: 'false',
    N8N_HIRING_BANNER_ENABLED: 'false',
    // Code nodes may use Node's crypto module for secure link tokens.
    NODE_FUNCTION_ALLOW_BUILTIN: 'crypto',
    // Workflows may only read/write files inside ./files
    N8N_RESTRICT_FILE_ACCESS_TO: FILES_DIR,
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false',
    N8N_SECURE_COOKIE: 'false',
  };
}

export function n8nBin() {
  const bin = path.join(N8N_HOME, 'node_modules', 'n8n', 'bin', 'n8n');
  if (!fs.existsSync(bin)) throw new Error(`n8n is not installed. Run "npm install" in ${N8N_HOME}`);
  return bin;
}
