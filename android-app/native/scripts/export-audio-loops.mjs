// Writes the web's music loop points (audio-loops.js) as a JSON asset: the native table plays the same tracks over the same seams.
// Usage: node scripts/export-audio-loops.mjs <repo root> <out file>
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const {LOOPS} = await import(pathToFileURL(join(root, 'audio-loops.js')).href);
writeFileSync(out, JSON.stringify(LOOPS));
console.log(`audio loops: ${Object.keys(LOOPS).length} tracks`);
