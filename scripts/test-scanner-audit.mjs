// Focused scanner safety gate. Provider/camera doubles and catalogue fixtures;
// browser, native OCR and physical-device evidence are separate checks.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=[
  "test-batch-scan-core.mjs",
  "test-batch-scan-pipeline.mjs",
  "test-batch-scan-vikavolt.mjs",
  "test-build-printing-recovery.mjs",
  "test-celebrations-scan.mjs",
  "test-scan-ai-read.mjs",
  "test-collector-search.mjs",
  "test-import-pricing-printings.mjs",
  "test-import-pricing-proven-printings.mjs",
  "test-import-pricing-scan-save.mjs",
  "test-magic-printing-budget.mjs",
  "test-magic-printing-flow.mjs",
  "test-printing-picker.mjs",
  "test-scan-adapter-bounds.mjs",
  "test-scan-adapter-options.mjs",
  "test-scan-bounded-recognition.mjs",
  "test-scan-capture-lifecycle.mjs",
  "test-scan-catalog-digital.mjs",
  "test-scan-catalog-retry.mjs",
  "test-scan-catalog.mjs",
  "test-scan-collector.mjs",
  "test-scan-confirm.mjs",
  "test-scan-fullcard-boundaries.mjs",
  "test-scan-geometry-regression.mjs",
  "test-scan-identifier-conflicts.mjs",
  "test-scan-identity-details.mjs",
  "test-scan-live-refinement.mjs",
  "test-scan-printing-evidence.mjs",
  "test-scan-release-identity.mjs",
  "test-scan-sensor-coverage.mjs",
  "test-scan-trainers.mjs",
  "test-scan.mjs",
  "test-scanart.mjs",
  "test-scancam.mjs",
  "test-scandetect.mjs",
  "test-scanner-game-switch.mjs",
  "test-scanner-inline.mjs",
  "test-scanner-printing.mjs",
  "test-scansession.mjs",
  "test-tcg-printing-integration.mjs",
  "test-ygo-ra01-printing.mjs",
  "test-ygo-scanner-codes.mjs",
  "test-scan-parser-audit.mjs",
  "test-scan-catalog-audit.mjs",
  "test-scan-camera-audit.mjs",
  "test-scan-edition-audit.mjs",
  "test-scan-ai-set-audit.mjs",
  "test-scan-aquapolis-audit.mjs",
  "test-scan-ocr-confidence-audit.mjs"
];
let failed=0;
for(const file of files){
 const run=spawnSync(process.execPath,[resolve(root,file)],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 if(run.status===0)console.log('PASS '+file);
 else {failed++;console.error('FAIL '+file);console.error(run.error?.message||run.stdout+run.stderr);}
}
console.log(JSON.stringify({commands:files.length,passed:files.length-failed,failed}));
process.exitCode=failed?1:0;
