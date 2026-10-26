import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Build output contains public source/dependency diagnostics. Runtime diagnosis
// reads only the probe's already-redacted aggregate observation and allowlists
// every returned value; raw runtime state, logs and credentials are never read.
export function safeProbeFailure(summary) {
  const observation=summary?.startupObservation;
  if(!observation||!['initializing','running','finished','failed','unknown'].includes(observation.status))return null;
  return {status:observation.status,awaitingChoice:observation.awaitingChoice===true,
    nativeRosterVerified:observation.nativeRosterVerified===true,pregameCommitted:observation.pregameCommitted===true,
    failureCategory:['native_deck_admission_failed','native_start_failed','native_runtime_failed'].includes(observation.failureCategory)?observation.failureCategory:null};
}
export async function reportBuildFailure(imageRoot) {
  try {
    const summary = JSON.parse(await readFile(path.join(imageRoot, 'image-summary.json'), 'utf8'));
    console.error(JSON.stringify({ build: Object.fromEntries(['result', 'failureCategory', 'buildSeconds', 'exportSeconds', 'imageId', 'sizeBytes', 'ociManifestDigest', 'imageRemovalConfirmed'].filter(k => summary[k] !== undefined).map(k => [k, summary[k]])) }));
    if (summary.imageId) {
      try { const probe=safeProbeFailure(JSON.parse(await readFile(path.join(imageRoot,'probe-summary.json'),'utf8')));if(probe)console.error(JSON.stringify({nativeProbe:probe})); } catch { /* no completed safe probe observation */ }
      return; // Image built: never substitute raw runtime logs.
    }
    let text = (await readFile(path.join(imageRoot, 'private-build.log'), 'utf8')).slice(-8000);
    for (const [name, value] of Object.entries(process.env)) {
      if (/TOKEN|SECRET|PASSWORD|API_KEY|AUTH_CONFIG/.test(name) && value?.length >= 8) text = text.split(value).join('[redacted]');
    }
    text = text.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/([?&](?:token|sig|key)=)[^&\s]+/gi, '$1[redacted]');
    console.error('Public image build failure (bounded tail):\n' + text);
  } catch { console.error('No completed image build diagnostics available'); }
}
