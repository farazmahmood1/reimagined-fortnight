// Runs a Code-node body in plain Node, with the same helpers n8n gets, so the rules can be tested without starting n8n.
// Used by test-rules.mjs. The real nodes are assembled by build-workflows.mjs in the same way.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './env.mjs';

export const SRC = (file) => fs.readFileSync(path.join(ROOT, 'src', file), 'utf8');

// file: a name in src/, or null when `code` is passed directly.
// bundle: what "Load data" returns (one array per table). webhook: the incoming request ({ json: { query, body }, binary }).
export function runNode(file, { code = '', bundle = {}, webhook = {}, preludes = [], prelude = '' } = {}) {
  const js = [SRC('shared.js'), ...preludes.map(SRC), prelude, file ? SRC(file) : code].join('\n');
  const item = { json: webhook.json || {}, binary: webhook.binary || {} };
  const $ = () => ({ first: () => item, all: () => [item] });
  const fn = new Function('$input', '$', 'require', js);
  return fn({ first: () => ({ json: bundle }), all: () => [{ json: bundle }] }, $, createRequire(import.meta.url));
}
