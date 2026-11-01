# Render every cue in cues.py to wav/, matched to the loudness of the file it replaces (so the game's mix
# stays as tuned), then encode Opus (stereo 64k, bundled in the APK) + AAC (web, Safari) into out/.
# Usage: python3 render.py [IDs...]
import sys, os, zlib, subprocess, wave, json
import numpy as np
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import kit
from cues import CUES, PUBLIC
OLD = os.path.join(D, '../../assets/audio/sfx')

def loud(x):
    """Loudest 50 ms RMS: how hard a short effect hits."""
    m = x.mean(axis=1) if x.ndim == 2 else x; w = kit.N(.05)
    if len(m) <= w: return float(np.sqrt((m ** 2).mean()) + 1e-9)
    c = np.cumsum(np.concatenate([[0], m ** 2])); r = (c[w:] - c[:-w]) / w
    return float(np.sqrt(r.max()) + 1e-9)
def old_level(cid):
    p = f'{OLD}/{cid}.ogg'
    if not os.path.exists(p): return None
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], capture_output=True).stdout
    return loud(np.frombuffer(raw, dtype=np.float32).astype(float))

import csv, re
BRIEF = {r['ID']: r['Length'] for r in csv.DictReader(open('/mnt/project-files/audio/cardstashy-sound-cues.csv'))}
def max_len(cid):
    m = re.findall(r'([\d.]+)\s*(ms|s)', BRIEF.get(cid, '').replace('\u2013', '-'))
    if not m: return 1.6
    v = max(float(a) / (1000 if u == 'ms' else 1) for a, u in m)
    return max(.3, v * 1.6 + .25)
def cap(x, sec):
    # Drop the far tail (below -54 dB of the peak), then fit the brief's length with a smooth fade.
    a = np.abs(x).max(axis=1); nz = np.nonzero(a > a.max() * 0.002)[0]
    if len(nz): x = x[: nz[-1] + 1]
    n = kit.N(sec)
    if len(x) > n:
        x = x[:n].copy(); f = min(n // 2, kit.N(max(.06, sec * .35))); x[-f:] *= (np.linspace(1, 0, f) ** 2)[:, None]
    return x
def build(cid):
    kit.seed(zlib.crc32(cid.encode())); return CUES[cid]()
if __name__ == '__main__':
    ids = sys.argv[1:] or PUBLIC
    for cid in ids: build(cid)          # pass 1: record the instrument parts every cue needs
    kit.render_pending()                # one FluidSynth pass for all of them
    for x in ('wav', 'out'): os.makedirs(f'{D}/{x}', exist_ok=True)
    levels = {cid: old_level(cid) for cid in ids}
    known = [v for v in levels.values() if v]; default = float(np.median(known)) if known else .2
    report = {}
    for cid in ids:
        x = cap(kit.finish(build(cid)), max_len(cid))      # pass 2: real audio
        target = levels[cid] or default
        g = min(target / loud(x), 10 ** (-1 / 20) / (np.abs(x).max() + 1e-9))
        x = np.clip(x * g, -1, 1)
        with wave.open(f'{D}/wav/{cid}.wav', 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000); w.writeframes((x * 32767).astype(np.int16).tobytes())
        for ext, args in (('ogg', ['-c:a', 'libopus', '-b:a', '64k']), ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{D}/wav/{cid}.wav', '-ar', '48000' if ext == 'ogg' else '44100', *args, '-map_metadata', '-1', f'{D}/out/{cid}.{ext}'], check=True)
        report[cid] = dict(sec=round(len(x) / 48000, 2), gain_db=round(20 * np.log10(g + 1e-12), 1), matched=bool(levels[cid]))
        print(cid, report[cid], flush=True)
    json.dump(report, open(f'{D}/out/report.json', 'w'), indent=0)
