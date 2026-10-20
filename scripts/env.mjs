// Shared settings for running the local n8n demo. Used by start.mjs and setup.mjs.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = 5678;
export const BASE_URL = `http://localhost:${PORT}`;
export const DATA_DIR = path.join(ROOT, 'data');
export const FILES_DIR = path.join(ROOT, 'files');

for (const dir of [DATA_DIR, FILES_DIR, path.join(FILES_DIR, 'documents'), path.join(FILES_DIR, 'payroll-exports'), path.join(FILES_DIR, 'umbrella-evidence'), path.join(FILES_DIR, 'applications')]) {
  fs.mkdirSync(dir, { recursive: true });
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
    // JavaScript only (no Python runner needed for this demo).
    N8N_PYTHON_ENABLED: 'false',
    N8N_RUNNERS_TASK_TIMEOUT: '60',
    N8N_EDITOR_BASE_URL: `${BASE_URL}/`,
    GENERIC_TIMEZONE: 'Europe/London',
    TZ: 'Europe/London',
    // Privacy: no telemetry, no update pings from the demo machine.
    N8N_DIAGNOSTICS_ENABLED: 'false',
    N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_PERSONALIZATION_ENABLED: 'false',
    N8N_HIRING_BANNER_ENABLED: 'false',
    // Code nodes may use Node's crypto module for secure link tokens.
    NODE_FUNCTION_ALLOW_BUILTIN: 'crypto',
    // Inbox triage reads CV text locally (PDF and Word) with libraries that ship with n8n.
    NODE_FUNCTION_ALLOW_EXTERNAL: 'pdf-parse,mammoth',
    // Workflows may only read/write files inside ./files
    N8N_RESTRICT_FILE_ACCESS_TO: FILES_DIR,
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false',
    N8N_SECURE_COOKIE: 'false',
  };
}

export function n8nBin() {
  const bin = path.join(ROOT, 'node_modules', 'n8n', 'bin', 'n8n');
  if (!fs.existsSync(bin)) throw new Error('n8n is not installed. Run: npm install');
  return bin;
}
