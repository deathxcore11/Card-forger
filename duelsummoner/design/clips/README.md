# Animation clips as plain data

These files hold the code-made animation clips (the ones written in `src/view/procclips.js` and `src/view/creature.js`) as plain JSON, so the native renderer can load the same clips the web view plays. Nothing in them is a Three.js object. Regenerate them with `node test/export-clips.mjs` (it also proves each file reads back into the same clip, worst difference about 6e-8).

Files: `kael.json`, `mira.json` (humanoids, 15 clips each), `ember-wyvern-f1.json`, `life-butterfly.json` (creatures, 11 clips each).

## Format

```
{ rig, kind: "humanoid" | "creature", axes: { F, U, R }, boneMap | parts, clips: [ { name, duration, tracks: [ { bone, path, times, values } ] } ] }
```

- **Frames:** the model's own frame, Y up, glTF quaternion order (x, y, z, w). `axes` are the model's forward, up and right unit vectors; use them to turn "forward" into the model's direction.
- **Track:** `path` is `rotation` (values are quaternions, 4 numbers per key) or `translation` (3 numbers per key, in model units, used only on the top bone for body bob and lunge). A rotation is the bone's **local** rotation relative to its parent bone, so a runtime sets `bone.localRotation = value` the way glTF animation does.
- **Times:** seconds from 0 to `duration`, 30 keys per second, linear interpolation between keys (spherical for rotations).
- **Bones:** `bone` is the cleaned node name of the Meshy rig (characters other than letters, digits and underscore become `_`, so `mixamorig:Hips` is `mixamorig_Hips`). `boneMap` (humanoids) lists the canonical names (Hips, Spine, Spine01, Spine02, neck, Head, LeftArm, ...) and the real bone for each, so one clip set serves any humanoid rig. `parts` (creatures) lists the labelled chains (wingL, wingR, legL, legR, tail, neck, head, spine) found from the rest pose.
- **Loops:** the looping clips close exactly: first and last pose match within 0.2 degrees (checked by `test/browser-loops.mjs` and `test/browser-creature-perf.mjs`).
- **Not here:** Meshy's own clips (Idle, Running, Walking, landings) stay in the GLB files, which are not in the repository.
