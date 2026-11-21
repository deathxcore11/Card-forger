# Lost Memories audio, batch 1

Drop-in for `crucible/web/`: `sound.mjs` plus this `audio/` folder. `sound.mjs` sets `window.LMAudio = { cue(name, data, ctx) }`, the hook Version 27 calls. Nothing else in the page needs to change except the one import.

## What is here

| Folder | Contents |
| --- | --- |
| `sfx/` | 129 one-shot effects, mono 44.1 kHz, `.ogg` (Vorbis) and `.mp3`. The module picks `.ogg` where the browser plays it, else `.mp3` (Safari on iPhone and Mac). |
| `amb/` | 6 ambience beds, stereo, 24 s, seamless (the tail is folded onto the head). Loop the whole file. |
| `manifest.json` | id → file, group, game event, description, status, duration, loop points, size. |

Total about 9 MB for both formats. Every file decoded in a browser test.

## Era pass (PS1 sound chip)

Every shipped file went through `tools/psx.py`: the real SPU ADPCM codec (28-sample blocks, 4-bit codes, the chip's five predictor filters), at period sample rates (effects 33 kHz, music 28 kHz, ambience 22 kHz), with SPU-like interpolation softness. Levels are restored afterwards. The clean masters stay on Randall's PC in `lost-memories-audio/masters_clean/`.

## Status words

- **Draft**: made and passed automated checks (decodes, no clipping, no DC, no clicks at the ends, ambience seams continuous, levels tiered). **Nobody has listened to these yet**, me included: the machine that made them has no way for me to hear audio. They become **approved** only when Randall says so on the soundboard.
- Every sound is original, generated from maths in `tools/sfx_defs.py` and `tools/amb.py`. No samples, nothing from Yu-Gi-Oh.

## How cues map to sounds (summary; the full table is `sound.mjs`)

- **Duel**: `duel:frame` plays one meld success sized to the meld (2, 3, 4+, or `meld_power` for a printed three-card fusion) and sequences relic chains at 170 ms per step (70 ms on fast), at most six, closing with `relic_chain_end` when three or more fired. Rival relics play at 60 %.
- `duel:summon` with `veiled`, or a rival summon without an id, plays `card_set`, the same sound as any set card. **No sound ever depends on a card id**, so hidden cards leak nothing.
- `duel:battle`: direct → `attack_direct`; no damage → `defend_block`; otherwise hit A/B/C by ATK difference (<500, <1500, more).
- `duel:lp`: small/large loss, gain; `lp_low_warning` once per duel when your LP first drops to 1500 or less.
- **Run**: `run:door` plays `door_open`, the door's accent, then `chamber_enter`. `duelStart/Won/Lost`, `mystery`, `over` have their own cues.
- **Story**: `story:boss:<id>` plays that guardian's arrival cue (six, one per guardian in the current build).
- **UI**: tap verbs map to quiet interface sounds. Verbs that already make a duel or run event (door, play, hit, pos, power, respond) stay silent to avoid doubles. Buy and Anvil actions wait 60 ms; if `refused` arrives, the refusal sound plays instead.
- **Screens**: each screen picks an ambience bed (chamber, furnace for the Anvil, bazaar, sanctum or omen after those doors, guardian for boss duels). Music ids are wired (`mus_explore`, `mus_duel`, `mus_guardian`, `mus_quiet`, `mus_title`) and stay silent until those files land in batch 2.

## Settings, mute, background

- Own storage key `lm-audio-v1`: master, effects, music, ambience, mute. `LMAudio.panel()` returns a ready settings block the page can mount anywhere.
- Hidden tab suspends the audio context; returning resumes it unless muted. iOS "interrupted" contexts resume on the next tap.
- Files load on first use; 21 core sounds are warmed after the first tap. Music will decode one track at a time.
- A missing or broken file is skipped. `cue` never throws.

## Checked so far

- In a desktop browser (`test-sound.html`): every cue name runs without error; veiled summons play only `card_set`; a six-relic chain plays 1-2-3-4-5-5 then resolve; a 3-card meld frame plays exactly one success; a refused buy plays only the refusal; mute stops new sounds; the low-LP warning fires once; a missing file is skipped; all 270 files decode.
- **Not checked**: listening by a person, a phone, the real game page, backgrounding on a device.

## Known gaps

- Music (added in batch 2): `mus/` holds four looping themes, stereo 48 kHz, each with a 1 s pre-roll and post-roll. Loop with Web Audio `loopStart`/`loopEnd` from the manifest's `loop` (for example [1.0, 107.67]); sound.mjs already does. Screens: chamber/reward/charm/kit → explore, duel → duel, boss duel → guardian, bazaar/sanctum and menus → quiet, Anvil and run summary → none. One track is decoded at a time and dropped after its fade.
- No dedicated cue yet for: deck-out (the engine reports it inside `end` with a reason; `deck_out` exists and can be wired once the reason value is confirmed), opponent "about to act" (`rival_action` exists, unused), shuffle at duel start, Codex discovery and unlock events (sounds exist; the page sends no cue for them yet).

## In this repository

Only this file, `manifest.json` and `../sound.mjs` are committed. The sound files themselves (.ogg and .mp3, about 21 MB) are published beside the private playable, like the card art, and are not in the public repository while they are still drafts nobody has listened to. Changes made to `sound.mjs` when it was merged on 21 November 2026: the audio folder is found from the page address (the page is one bundled script), a deck-out plays `deck_out`, two page cues were added (`codex:new` and `unlock`), and a missing or broken file no longer leaves an unhandled "Unable to decode audio data" rejection on the page. A page opened straight from a file (no server) stays silent instead of logging a fetch error per sound.
