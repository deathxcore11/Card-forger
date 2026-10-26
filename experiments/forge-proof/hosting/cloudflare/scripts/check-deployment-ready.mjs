import { readFileSync } from 'node:fs';
import { nativeAdapter } from '../src/native-adapter.mjs';
import { trialPolicy } from '../src/trial.mjs';
const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const blockers = [];
if (/REQUIRED_ACCOUNT|sha256:0{64}/.test(config)) blockers.push('Reviewed exact-deck native image digest/account is not configured.');
if (!trialPolicy(JSON.parse(config).vars || {}, Date.now())) blockers.push('Explicit verified-owner allowlist, unexpired trial window and bounded resource allocation must be reviewed/configured.');
if (!nativeAdapter({}).ready) blockers.push('Real snapshot-aware admission and native initialization bridge is not installed.');
if (blockers.length) { console.error(blockers.join('\n')); process.exitCode = 1; }
