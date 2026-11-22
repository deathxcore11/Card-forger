# Seeded stage generator: Node prototype (spec v2)

Reference build for `../generator-spec.md`. Pure Node, no dependencies, integer maths.

- One map: `node gen.mjs --seed 42 --stage 2 --out out`
- Batch check: `node batch.mjs --count 50`
- Tests: `node test.mjs` (13 pass in the cloud, 22 Nov 2026)
- Float physics oracle for jump links: `node tools/physcheck.mjs`

`samples/` holds three rendered maps for seal 00000001 (stages 1 to 3).

Status: Pass for the tests and validator in Node. Not assessed in the game: nothing here has been seen in the 3D build yet.
