# Render cues: MIDI -> FluidSynth (MuseScore General soundfont) -> loudness-ready WAV, plus loop points.
# A looping cue is built as three passes of its form (new melodies each pass, a breakdown opening the
# second), so it runs about three minutes before repeating. The end's reverb tail is folded onto the start,
# and the file holds one second of the loop's end before it and one second of its start after it; the game
# loops between those points, inside continuous audio, so the seam is exact whatever an encoder pads.
import sys, subprocess, wave, numpy as np, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine
from tracks import CUES
SF = '/usr/share/sounds/sf2/MuseScore_General_Full.sf2'
D = os.path.dirname(os.path.abspath(__file__))
PASSES = 3
# Rhythm and bass layers that sit out the first bars of the second pass, so the loop breathes.
BREAK = {'drums', 'low', 'timp', 'bass', 'tuba', 'color', 'cello', 'pizz', 'kalimba', 'lute', 'gtr', 'guitar'}
def run(cmd): subprocess.run(cmd, check=True, capture_output=True)
def build(cid):
    engine.VAR = 0; s, bars, loop = CUES[cid]()
    if not loop: return s, bars, False
    bt = s.bar_ticks; L = bars * bt
    passes = []
    for v in range(PASSES):
        engine.VAR = v; passes.append(CUES[cid]()[0])
    engine.VAR = 0
    for t in s.tracks.values(): t['notes'] = []
    for v, sv in enumerate(passes):
        for name, t in sv.tracks.items():
            for st, d, p, vel in t['notes']:
                if v == 1 and st < 8 * bt and name in BREAK: continue
                s.tracks[name]['notes'].append((st + v * L, d, p, vel))
    return s, bars * PASSES, True
def render(cid):
    s, bars, loop = build(cid)
    mid = f'{D}/mid/{cid}.mid'; raw = f'{D}/wav/{cid}.raw.wav'; out = f'{D}/wav/{cid}.wav'
    for x in ('mid', 'wav', 'out'): os.makedirs(f'{D}/{x}', exist_ok=True)
    if loop:
        secs = s.save(mid, bars, tail_bars=3)
    else:
        secs = s.save(mid, bars, tail_bars=4)
    run(['fluidsynth', '-ni', '-q', '-g', '0.35', '-r', '48000', '-R', '1', '-C', '0', '-o', 'synth.reverb.room-size=0.75', '-o', 'synth.reverb.width=0.9', '-o', 'synth.reverb.level=0.6', '-o', 'player.timing-source=sample', '-o', 'synth.cpu-cores=1', '-F', raw, SF, mid])
    with wave.open(raw) as w: a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).astype(np.float32)
    points = None
    if loop:
        # Fold the end's reverb tail onto the start, so the loop is exactly periodic; then wrap one second
        # of it on each side, and loop between those two points.
        L = int(round(secs * 48000)); pre = 48000
        body = a[:L].copy(); tail = a[L:]; k = min(len(tail), L); body[:k] += tail[:k]
        a = np.concatenate([body[-pre:], body, body[:pre]])
        points = [round(pre / 48000, 6), round((pre + L) / 48000, 6)]
    else:
        f = int(0.5 * 48000); nz = np.nonzero(np.abs(a).max(axis=1) > 30)[0]; a = a[: (nz[-1] + 1 if len(nz) else len(a))]
        a[-f:] *= np.linspace(1, 0, f)[:, None]
    peak = np.abs(a).max() or 1; a = a / peak * 30000
    with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000); w.writeframes(a.astype(np.int16).tobytes())
    os.remove(raw)
    return cid, points
if __name__ == '__main__':
    from concurrent.futures import ProcessPoolExecutor
    ids = sys.argv[1:] or list(CUES)
    loops = {}
    with ProcessPoolExecutor(4) as ex:
        for cid, pts in ex.map(render, ids):
            print(cid, pts)
            if pts: loops[cid] = pts
    # Loop points for audio.js: [start, end] in seconds.
    with open(f'{D}/out/loops.json', 'w') as f: json.dump(loops, f, indent=0, sort_keys=True)
    body = ',\n'.join(f'  "{k}": [{v[0]}, {v[1]}]' for k, v in sorted(loops.items()))
    with open(f'{D}/out/audio-loops.js', 'w') as f:
        f.write('// Loop points [start, end] in seconds for each looping music track (written by scripts/music/render.py).\n'
                '// Each file wraps a second of its loop on both sides, so the seam is inside continuous audio.\n'
                'export const LOOPS = {\n' + body + '\n};\n')
