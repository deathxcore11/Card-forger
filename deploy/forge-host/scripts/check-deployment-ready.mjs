import { readFile } from 'node:fs/promises';
import { nativeAdapter } from '../src/native-adapter-next.mjs';
import { admissionPolicy } from '../src/admission-policy.mjs';
import { assertReleaseConfiguration } from './release-configuration.mjs';
const config = JSON.parse(await readFile(process.argv[2] || new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
assertReleaseConfiguration(config);
if (!admissionPolicy(config.vars, Date.now()) || !nativeAdapter(config.vars).ready) throw Error('release_not_ready');
console.log('PASS bounded authenticated admission and immutable image policy; real-account gameplay remains a separate acceptance check.');
