// Re-pins shared-source/ to a reviewed website commit so the app runs exactly the website's code.
// Usage: node scripts/rebaseline-source.mjs <website-repo> <commit> [extra-path ...]
// Every snapshot file is taken from the commit itself (git show), never from a working tree, and the
// manifest, baseline and artwork pin are rewritten with the new hashes. Extra paths add files the
// website started depending on since the last pin; build-web.mjs refuses to run if one is missing.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [repo, ref, ...extra] = process.argv.slice(2);
if (!repo || !ref) throw Error('Usage: node scripts/rebaseline-source.mjs <website-repo> <commit> [extra-path ...]');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 1 << 30 });
const commit = git('rev-parse', '--verify', `${ref}^{commit}`).toString().trim();
const tree = git('rev-parse', `${commit}^{tree}`).toString().trim();
const version = JSON.parse(git('show', `${commit}:package.json`)).version;

const manifestFile = path.join(root, 'shared-source-manifest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
// Files the website has since deleted drop out of the snapshot (build-web.mjs still refuses a missing one it needs).
const inCommit = new Set(git('ls-tree', '-r', '--name-only', commit).toString().split('\n'));
const dropped = manifest.files.map(f => f.path).filter(file => !inCommit.has(file));
const paths = [...new Set([...manifest.files.map(f => f.path), ...extra])].filter(file => inCommit.has(file) || extra.includes(file)).sort();
const source = path.join(root, 'shared-source');
await rm(source, { recursive: true, force: true });
const files = [];
for (const file of paths) {
  if (path.posix.normalize(file) !== file || file.startsWith('../') || path.isAbsolute(file)) throw Error(`Unsafe path: ${file}`);
  const bytes = git('show', `${commit}:${file}`);
  await mkdir(path.dirname(path.join(source, file)), { recursive: true });
  await writeFile(path.join(source, file), bytes);
  files.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(manifestFile, JSON.stringify({ ...manifest, version, commit, tree, files }, null, 2) + '\n');
const baselineFile = path.join(root, 'source-baseline.json');
await writeFile(baselineFile, JSON.stringify({ ...JSON.parse(await readFile(baselineFile, 'utf8')), commit, version }, null, 2) + '\n');
const artFile = path.join(root, 'offline-art-sources.json');
await writeFile(artFile, JSON.stringify({ ...JSON.parse(await readFile(artFile, 'utf8')), sourceCommit: commit }, null, 2) + '\n');
console.log(`shared-source pinned to ${version} (${commit}), ${files.length} files${dropped.length ? `, ${dropped.length} deleted files dropped` : ''}.`);
