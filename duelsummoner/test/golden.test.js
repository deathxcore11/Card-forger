// Golden traces: every scene's recorded tape must replay to the same per-tick state hash, event log and snapshots.
// A failure names the first tick that differs. If the change was meant, regenerate with `node tools/trace.mjs --regen` and say so in the commit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../tools/scenes.mjs';
import { check, loadGolden } from '../tools/trace.mjs';

for (const s of SCENES) test('golden trace: ' + s.name, () => { assert.equal(check(s, loadGolden(s.name)), null); });
