# CardStashy score

Original music for Planeswalk and the Magic match table (assets/audio/music), composed in code and
rendered with real sampled instruments, so there is nothing to license or credit.

- `tracks.py` — one function per cue (MUS-PW-*, MUS-TBL-*): key, tempo, progression, instruments, melodies.
  The wandering theme (THEME_A/B) is shared by the title, the act maps and the rest site.
- `engine.py` — chords, voicings, patterns and motif melodies to MIDI.
- `render.py` — MIDI → FluidSynth with the MuseScore General soundfont (MIT), folds the reverb tail into
  the start so loops are seamless. `encode.py` — loudness (−19 LUFS, stings −16) → Opus 64k + AAC 96k.
- `check.py` — counts semitone clashes between held notes per cue.

Setup: `apt-get install fluidsynth musescore-general-soundfont-lossless && pip install mido numpy`.
Render all: `python3 render.py && python3 encode.py`, then copy `out/*` to `assets/audio/music/`.
