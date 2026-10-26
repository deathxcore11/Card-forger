import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Build output contains public source/dependency diagnostics, never a game's
// private input or native state. No runtime/probe/credential file is read here.
export async function reportBuildFailure(imageRoot) {
  try {
    const summary = JSON.parse(await readFile(path.join(imageRoot, 'image-summary.json'), 'utf8'));
    console.error(JSON.stringify({ build: Object.fromEntries(['result', 'failureCategory', 'buildSeconds', 'exportSeconds', 'imageId', 'sizeBytes', 'ociManifestDigest', 'imageRemovalConfirmed'].filter(k => summary[k] !== undefined).map(k => [k, summary[k]])) }));
    if (summary.imageId) return; // Image built: never substitute runtime logs.
    let text = (await readFile(path.join(imageRoot, 'private-build.log'), 'utf8')).slice(-8000);
    for (const [name, value] of Object.entries(process.env)) {
      if (/TOKEN|SECRET|PASSWORD|API_KEY|AUTH_CONFIG/.test(name) && value?.length >= 8) text = text.split(value).join('[redacted]');
    }
    text = text.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/([?&](?:token|sig|key)=)[^&\s]+/gi, '$1[redacted]');
    console.error('Public image build failure (bounded tail):\n' + text);
  } catch { console.error('No completed image build diagnostics available'); }
}
