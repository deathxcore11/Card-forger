// Actual runtime response witness; does not equate offers with completeness.
import assert from 'node:assert/strict';
import {bootAcceptance} from './acceptance-inputs.mjs';
import {prepare,deck} from './mechanics-fixtures.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {readShippedResponseProof} from './shipped-response-proof.mjs';
import {RUNTIME_IDENTITY} from './runtime-assets.mjs';
const {engine:e}=await bootAcceptance(['Forest','Giant Growth','Bear Cub']);
const f=prepare(e,deck('Forest','Giant Growth','Bear Cub'),deck('Forest'));
f.s.format_config=e.getFormatRegistry().find(f=>f.format==='Standard').default_config;
const [spell]=f.move('Giant Growth',0,'Hand');f.move('Forest',0,'Battlefield');f.move('Bear Cub',0,'Battlefield');f.s.phase='Upkeep';f.s.active_player=1;f.restore();
const before=e.export_game_state_json(),view=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0);
assert(view.canSubmit);assert(view.opportunities.some(o=>o.choices?.some(c=>c.available&&c.surfaces.some(s=>s.type==='action'&&s.code==='castSpell')&&c.surfaces.some(s=>s.type==='object'&&s.reference===String(spell)))),'Giant Growth must have a live cast offer with Forest and a target');
assert.equal(readShippedResponseProof(e,0,RUNTIME_IDENTITY.wasmSha256),null,'Smart must stop for this response');assert.equal(e.export_game_state_json(),before,'assessment must be read-only');
console.log('PASS: Giant Growth with an untapped Forest and Bear Cub target remains an offered response on the opponent turn; Smart does not auto-pass.');
