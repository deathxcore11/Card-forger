# CardStashy sound effects

Every effect in `assets/audio/sfx/` (ID.ogg for the app, ID.m4a for Safari) is built here. Real sampled
instruments (FluidSynth + the MuseScore General soundfont, MIT) are layered with designed foley: noise-shaped
whooshes, cards and cloth, modal-synthesis bells, glass, coins and metal, pitch-dropped impacts, and a shared room reverb.

- `kit.py`: the building blocks.
- `cues.py`: one recipe per cue ID, written to the brief in the project's cardstashy-sound-cues.csv.
- `render.py`: renders the cues (all, or the IDs given) to `wav/` and `out/`. Each cue's loudness is matched to
  the file it replaces, so the game's mix stays as tuned. The output is Opus stereo 64k plus AAC 96k.

Setup: `pip install mido numpy scipy` and fluidsynth with the MuseScore General soundfont (see ../music/README.md).
Then run `python3 render.py`, copy `out/*.ogg out/*.m4a` to `assets/audio/sfx/`, and bump `SFX_REV` in audio.js.
