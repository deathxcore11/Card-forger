import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REQUIRED_GATES = ['authenticatedApi', 'accountCallbacks', 'accountIsolation', 'allGameFeatureParity', 'cameraAndFilesOnDevice', 'removableArtworkOnDevice', 'offlineDurability', 'performanceComparison', 'releaseSigning', 'verifiedDownload'];
export function evaluateReadiness(evidence) {
  const failures = REQUIRED_GATES.filter(name => evidence?.gates?.[name]?.passed !== true || typeof evidence.gates[name].evidence !== 'string' || !evidence.gates[name].evidence.trim());
  return { releaseReady: failures.length === 0, failures };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let evidence = {};
  try { evidence = JSON.parse(await readFile(path.join(root, 'release-evidence.json'), 'utf8')); } catch {}
  const result = evaluateReadiness(evidence);
  console.log(JSON.stringify(result, null, 2));
  if (!result.releaseReady) process.exitCode = 2;
}
