# Render cues: MIDI -> FluidSynth (MuseScore General soundfont) -> seamless loop fold -> loudness -> Opus/AAC.
import sys, subprocess, wave, numpy as np, os
sys.path.insert(0, os.path.dirname(__file__))
from tracks import CUES
SF = '/usr/share/sounds/sf2/MuseScore_General_Full.sf2'
D = os.path.dirname(os.path.abspath(__file__))
def run(cmd): subprocess.run(cmd, check=True, capture_output=True)
def render(cid):
    s, bars, loop = CUES[cid]()
    mid = f'{D}/mid/{cid}.mid'; raw = f'{D}/wav/{cid}.raw.wav'; out = f'{D}/wav/{cid}.wav'
    secs = s.save(mid, bars, tail_bars=3 if loop else 4)
    run(['fluidsynth', '-ni', '-q', '-g', '0.35', '-r', '48000', '-R', '1', '-C', '0', '-o', 'synth.reverb.room-size=0.75', '-o', 'synth.reverb.width=0.9', '-o', 'synth.reverb.level=0.6', '-F', raw, SF, mid])
    with wave.open(raw) as w: n = w.getnframes(); a = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, 2).astype(np.float32)
    L = int(round(secs * 48000))
    if loop:
        body = a[:L].copy(); tail = a[L:]
        k = min(len(tail), L); body[:k] += tail[:k]   # the end's reverb rings into the start: a seamless loop
        a = body
    else:
        f = int(0.5 * 48000); a = a[: len(a)]
        nz = np.nonzero(np.abs(a).max(axis=1) > 30)[0]; a = a[: (nz[-1] + 1 if len(nz) else len(a))]
        a[-f:] *= np.linspace(1, 0, f)[:, None]
    peak = np.abs(a).max() or 1; a = a / peak * 30000
    with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000); w.writeframes(a.astype(np.int16).tobytes())
    os.remove(raw)
    return cid, round(len(a) / 48000, 1), loop
if __name__ == '__main__':
    from concurrent.futures import ProcessPoolExecutor
    ids = sys.argv[1:] or list(CUES)
    with ProcessPoolExecutor(4) as ex:
        for r in ex.map(render, ids): print(*r)
