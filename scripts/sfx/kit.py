# Sound-design kit for CardStashy's effects: real sampled instruments (FluidSynth + MuseScore General) layered
# with designed foley (noise shaping, modal synthesis, pitch-dropped thumps) and a shared room reverb.
# Everything is stereo float at 48 kHz; cues.py builds each cue from these pieces.
import os, subprocess, tempfile, wave, functools
import numpy as np
import mido
from scipy import signal

SR = 48000
SF = '/usr/share/sounds/sf2/MuseScore_General_Full.sf2'
rng = np.random.default_rng(7)

def seed(n): global rng; rng = np.random.default_rng(n)
def N(sec): return max(1, int(round(sec * SR)))
def silence(sec): return np.zeros((N(sec), 2))
def st(m, pan=0.0):
    """Mono -> stereo with an equal-power pan (-1 left .. 1 right)."""
    a = (pan + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], axis=1)
def mono(x): return x.mean(axis=1) if x.ndim == 2 else x

def mix(*parts):
    """parts: (signal, start_sec, gain) or a signal. Returns a stereo mix long enough for every part."""
    items = []
    for p in parts:
        if isinstance(p, tuple): x, t0, g = p[0], (p[1] if len(p) > 1 else 0.0), (p[2] if len(p) > 2 else 1.0)
        else: x, t0, g = p, 0.0, 1.0
        if x.ndim == 1: x = st(x)
        items.append((x, N(t0) if t0 else 0, g))
    L = max(s + len(x) for x, s, _ in items)
    out = np.zeros((L, 2))
    for x, s, g in items: out[s:s + len(x)] += x * g
    return out

# --- envelopes ------------------------------------------------------------------------------
def env_exp(n, decay, attack=0.002):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t / max(decay, 1e-4))
def env_ar(n, attack, release, curve=2.0):
    t = np.linspace(0, 1, n); k = attack / (attack + release)
    up = np.where(t < k, (t / max(k, 1e-6)) ** curve, 1)
    down = np.where(t >= k, (1 - (t - k) / max(1 - k, 1e-6)) ** curve, 1)
    return up * down
def fade(x, fin=0.002, fout=0.03):
    x = x.copy(); a, b = N(fin), N(fout)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b and b < len(x): x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x

# --- filters -----------------------------------------------------------------------------------
def _sos(kind, f, order=2):
    f = np.clip(np.atleast_1d(f), 20, SR / 2 - 200)
    return signal.butter(order, f if kind in ('bandpass', 'bandstop') else f[0], btype=kind, fs=SR, output='sos')
def lp(x, f, order=2): return signal.sosfilt(_sos('lowpass', f, order), x, axis=0)
def hp(x, f, order=2): return signal.sosfilt(_sos('highpass', f, order), x, axis=0)
def bp(x, lo, hi, order=2): return signal.sosfilt(_sos('bandpass', [lo, hi], order), x, axis=0)
def sweep_bp(x, f0, f1, q=2.0, block=256):
    """Band-pass whose centre glides from f0 to f1 (log), block by block with carried state."""
    out = np.zeros_like(x); n = len(x); zi = None
    nb = max(1, n // block)
    for i in range(nb + 1):
        s, e = i * block, min(n, (i + 1) * block)
        if s >= e: break
        f = f0 * (f1 / f0) ** (s / max(1, n - 1)); bw = f / q
        sos = _sos('bandpass', [max(30, f - bw / 2), min(SR / 2 - 300, f + bw / 2)])
        if zi is None or zi.shape[0] != sos.shape[0]: zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        out[s:e], zi = signal.sosfilt(sos, x[s:e], axis=0, zi=zi)
    return out
def sweep_lp(x, f0, f1, block=256):
    out = np.zeros_like(x); n = len(x); zi = None
    for i in range(n // block + 1):
        s, e = i * block, min(n, (i + 1) * block)
        if s >= e: break
        f = f0 * (f1 / f0) ** (s / max(1, n - 1))
        sos = _sos('lowpass', f)
        if zi is None: zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        out[s:e], zi = signal.sosfilt(sos, x[s:e], axis=0, zi=zi)
    return out

# --- sources -----------------------------------------------------------------------------------
def noise(sec, color='white'):
    w = rng.standard_normal(N(sec))
    if color == 'pink':
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        w = signal.lfilter(b, a, w) * 4
    elif color == 'brown':
        w = np.cumsum(w); w = hp(w - w.mean(), 20) / (np.abs(w).max() + 1e-9) * 3
    return w
def modal(freqs, decays, amps=None, sec=None, jitter=0.0):
    """Damped sinusoid bank: bells, glass, coins, wood. decays in seconds (per mode)."""
    freqs = np.atleast_1d(freqs).astype(float); decays = np.broadcast_to(decays, freqs.shape)
    amps = np.ones_like(freqs) if amps is None else np.broadcast_to(amps, freqs.shape)
    sec = sec or float(max(decays) * 5)
    t = np.arange(N(sec)) / SR; out = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        f = f * (1 + jitter * rng.uniform(-1, 1))
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    out *= np.minimum(1, t / 0.0008) * np.minimum(1, (t[-1] - t) / min(.05, sec / 4))  # no click at either end
    return out / (np.abs(out).max() + 1e-9)
def thump(f0=120, f1=40, sec=0.35, drop=0.06, click=0.3):
    """Pitch-dropping sine body with a short noise click: the weight under impacts and slams."""
    t = np.arange(N(sec)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / drop)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (sec / 3.5)) * np.minimum(1, (t[-1] - t) / min(.03, sec / 4))
    c = hp(noise(0.012), 1500) * env_exp(N(0.012), 0.003) * click
    body[:len(c)] += c
    return body / (np.abs(body).max() + 1e-9)
def burst(sec, lo, hi, decay=None, color='white', attack=0.001):
    x = bp(noise(sec, color), lo, hi)
    return x * env_exp(len(x), decay or sec / 4, attack)
def whoosh(sec=0.4, f0=300, f1=2500, q=1.6, peak=0.6, color='pink', pan0=0, pan1=0):
    x = sweep_bp(noise(sec, color), f0, f1, q)
    t = np.linspace(0, 1, len(x))
    e = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.5)
    x = x * e; x /= np.abs(x).max() + 1e-9
    p = np.linspace(pan0, pan1, len(x)); a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)
def crackle(sec, rate=60, lo=1500, hi=9000, body=0.3):
    """Fire: sparse filtered pops over a soft roar."""
    n = N(sec); out = np.zeros(n)
    k = rng.poisson(rate * sec)
    for _ in range(k):
        p = rng.integers(0, n); l = rng.integers(40, 400)
        pop = rng.standard_normal(l) * np.exp(-np.arange(l) / (l / 4)) * rng.uniform(.2, 1)
        out[p:p + l] += pop[:max(0, min(l, n - p))]
    out = bp(out, lo, hi) + body * lp(noise(sec, 'brown'), 700)
    return out / (np.abs(out).max() + 1e-9)
def paper(sec=0.06, bright=4000):
    """Card and paper: a fast noisy slap with a little papery band."""
    x = bp(noise(sec), bright * .35, min(16000, bright * 2.5)) * env_exp(N(sec), sec / 5, 0.0005)
    return x / (np.abs(x).max() + 1e-9)
def snap(bright=6000):
    return mix((paper(0.03, bright), 0, 1), (paper(0.05, bright * .6), 0.008, .5))
def wood(f=900, sec=0.12):
    """Wood block / board tick: few inharmonic modes, fast decay."""
    return modal([f, f * 2.46, f * 3.97], [sec / 3, sec / 6, sec / 10], [1, .4, .15], sec=sec)
def metal(f=1800, sec=0.8, bright=1.0):
    r = [1, 2.76, 5.40, 8.93, 13.34]
    return modal([f * x for x in r], [sec / (1 + i * .9) for i in range(5)], [1, .6 * bright, .4 * bright, .25 * bright, .12 * bright], sec=sec, jitter=.004)
def glass(f=2400, sec=0.9):
    return modal([f, f * 2.32, f * 4.25, f * 6.63], [sec, sec / 2, sec / 3.5, sec / 6], [1, .5, .3, .15], sec=sec * 1.2, jitter=.003)
def bell(f=660, sec=2.5):
    r = [0.5, 1, 1.183, 1.506, 2.0, 2.514, 3.011]
    return modal([f * x for x in r], [sec * 1.2, sec, sec * .7, sec * .6, sec * .5, sec * .35, sec * .25], [.5, 1, .6, .5, .4, .25, .18], sec=sec * 1.4)
def coin(f=None):
    f = f or rng.uniform(3600, 5200)
    return modal([f, f * 1.47, f * 2.09, f * 2.81, f * 3.6], [.25, .18, .12, .08, .05], [1, .7, .5, .35, .2], sec=.35, jitter=.01)
def coins(n=6, spread=0.35, f=None, pan=0.4):
    parts = []
    for i in range(n):
        c = coin(f) * rng.uniform(.4, 1)
        parts.append((st(c, rng.uniform(-pan, pan)), i * spread / max(1, n - 1) + rng.uniform(0, .02), 1))
    return mix(*parts)
def shatter(sec=0.6, base=2500, n=26):
    parts = [(burst(0.08, 2000, 12000, 0.02), 0, .8)]
    for _ in range(n):
        g = glass(base * rng.uniform(.8, 2.6), rng.uniform(.08, .3)) * rng.uniform(.15, .6)
        parts.append((st(g, rng.uniform(-.7, .7)), rng.exponential(sec / 5), 1))
    return mix(*parts)
def crystal_ping(f=2093, sec=0.7): return glass(f, sec)
def drip(f0=900, f1=2400, sec=0.12):
    t = np.arange(N(sec)) / SR; f = f0 * (f1 / f0) ** (t / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), sec / 3, 0.001)
def heartbeat(bpm=60, beats=2):
    one = mix((thump(70, 38, .25, .03, .05), 0, 1), (thump(62, 36, .22, .03, .05), .18, .7))
    return mix(*[(one, i * 60 / bpm, 1) for i in range(beats)])

# --- sampled instruments (FluidSynth) ----------------------------------------------------------
# FluidSynth takes ~30 s to load the soundfont, so every instrument part of every cue is rendered in one
# pass: cues run once to record what they need (getting silence), render_pending() renders it all in one
# MIDI file with gaps between parts, and the cues run again with the real audio.
_cache, _pending = {}, []
def _render(spec):
    if spec in _cache: return _cache[spec]
    if spec not in _pending: _pending.append(spec)
    return np.zeros((N(.5), 2))
def render_pending():
    if not _pending: return
    mid = mido.MidiFile(ticks_per_beat=960)  # 120 bpm: 1 s = 1920 ticks
    meta = mido.MidiTrack(); mid.tracks.append(meta); meta.append(mido.MetaMessage('set_tempo', tempo=500000))
    evs = {c: [] for c in range(16)}; spans = []; t0 = 0.5
    for spec in _pending:
        end = 0
        for prog, ch, notes, bank in spec:
            a0 = int(t0 * 1920)
            if bank: evs[ch].append((a0, 0, mido.Message('control_change', channel=ch, control=0, value=bank)))
            if ch != 9: evs[ch].append((a0, 0, mido.Message('program_change', channel=ch, program=prog)))
            for t, d, p, v in notes:
                a = int((t0 + t) * 1920); b = int((t0 + t + d) * 1920); end = max(end, t + d)
                evs[ch].append((a, 2, mido.Message('note_on', channel=ch, note=int(p), velocity=int(max(1, min(127, v))))))
                evs[ch].append((b, 1, mido.Message('note_off', channel=ch, note=int(p), velocity=0)))
        spans.append((spec, t0, end + 3.5)); t0 += end + 5.0
    for c, ev in evs.items():
        if not ev: continue
        tr = mido.MidiTrack(); mid.tracks.append(tr)
        tr.append(mido.Message('control_change', channel=c, control=91, value=0, time=0))
        tr.append(mido.Message('control_change', channel=c, control=93, value=0, time=0))
        ev.sort(key=lambda e: (e[0], e[1])); now = 0
        for at, _, m in ev: tr.append(m.copy(time=at - now)); now = at
    meta.append(mido.MetaMessage('end_of_track', time=int(t0 * 1920)))
    with tempfile.TemporaryDirectory() as d:
        mp, wp = f'{d}/a.mid', f'{d}/a.wav'; mid.save(mp)
        subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.5', '-r', str(SR), '-R', '0', '-C', '0', '-o', 'player.timing-source=sample',
                        '-o', 'synth.cpu-cores=2', '-F', wp, SF, mp], check=True, capture_output=True)
        with wave.open(wp) as w: a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).astype(np.float64) / 32768
    for spec, s0, ln in spans:
        x = a[N(s0):N(s0 + ln)]
        nz = np.nonzero(np.abs(x).max(axis=1) > 2e-4)[0]
        _cache[spec] = x[: nz[-1] + 1] if len(nz) else x[:N(.1)]
    _pending.clear()
def inst(program, notes, channel=0, bank=0):
    """notes: [(t_sec, dur_sec, midi, vel)]. Program numbers are General MIDI (0-based)."""
    return _render(((program, channel, tuple(tuple(float(v) if i < 2 else int(v) for i, v in enumerate(n)) for n in notes), bank),)).copy()
def drum(notes): return _render(((0, 9, tuple(tuple(float(v) if i < 2 else int(v) for i, v in enumerate(n)) for n in notes), 0),)).copy()
def chord(program, pitches, t=0, dur=1.0, vel=90, strum=0.0):
    return inst(program, [(t + i * strum, dur, p, vel) for i, p in enumerate(pitches)])
def gliss(program, lo, hi, sec=0.5, vel=70, scale=(0, 2, 4, 7, 9), up=True, dur=0.6):
    ps = [p for p in range(lo, hi + 1) if p % 12 in scale]
    if not up: ps = ps[::-1]
    return inst(program, [(i * sec / len(ps), dur, p, vel) for i, p in enumerate(ps)])

# GM programs used here
HARP, CELESTA, GLOCK, MUSICBOX, VIBES, MARIMBA, XYLO, TUBULAR, DULCIMER = 46, 8, 9, 10, 11, 12, 13, 14, 15
ORGAN, NYLON, LUTE, STRINGS, TREM, PIZZ, TIMP, SLOWSTR, CHOIR, OOHS = 19, 24, 24, 48, 44, 45, 47, 49, 52, 53
ORCHHIT, TRUMPET, TROMBONE, HORN, BRASS, FIDDLE, WHISTLE, PANFLUTE, FLUTE, TAIKO, REVCYM, KALIMBA = 55, 56, 57, 60, 61, 110, 78, 75, 73, 116, 119, 108

# --- space and finishing ------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def _ir(size, dark):
    n = N(size); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (size / 6.9))[:, None]
    ir = sweep_lp(ir, 12000, dark)
    ir[:N(.004)] *= np.linspace(0, 1, N(.004))[:, None]
    return ir / np.sqrt((ir ** 2).sum(axis=0))
def verb(x, wet=0.25, size=1.4, dark=3000, pre=0.012):
    if x.ndim == 1: x = st(x)
    ir = _ir(round(size, 2), int(dark))
    w = np.stack([signal.fftconvolve(x[:, i], ir[:, i]) for i in range(2)], axis=1)
    w = np.concatenate([np.zeros((N(pre), 2)), w])
    out = np.zeros((len(w), 2)); out[:len(x)] += x * (1 - wet * .5); out += w * wet
    return out
def widen(x, amt=0.3):
    if x.ndim == 1: x = st(x)
    m, s = x.mean(axis=1), (x[:, 0] - x[:, 1]) / 2
    s = s * (1 + amt); return np.stack([m + s, m - s], axis=1)
def pitch(x, ratio):
    """Resample (changes length): ratio 2 = an octave up."""
    n = int(len(x) / ratio); idx = np.linspace(0, len(x) - 1, n)
    if x.ndim == 1: return np.interp(idx, np.arange(len(x)), x)
    return np.stack([np.interp(idx, np.arange(len(x)), x[:, i]) for i in range(2)], axis=1)
def rev(x): return x[::-1].copy()
def trim(x, thresh=1e-4, tail=0.04):
    a = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    nz = np.nonzero(a > thresh * (a.max() + 1e-12))[0]
    if not len(nz): return x
    x = x[: min(len(x), nz[-1] + N(tail))]
    return fade(x, 0.0005, min(0.05, len(x) / SR / 4))
def finish(x, peak_db=-1.0):
    if x.ndim == 1: x = st(x)
    x = hp(x, 35, 2)
    x = trim(x)
    pk = np.abs(x).max() + 1e-12
    x = x / pk * 10 ** (peak_db / 20)
    return np.tanh(x * 1.05) / np.tanh(1.05)
