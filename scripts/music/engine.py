# Small composition engine: chords, voicings, patterns and motif-based melodies -> MIDI.
import random, mido

TPB = 480
VAR = 0  # which pass of a long loop is being built (changes melodies and humanizing)
NOTE = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
QUAL = {'':[0,4,7],'m':[0,3,7],'dim':[0,3,6],'aug':[0,4,8],'sus2':[0,2,7],'sus4':[0,5,7],'5':[0,7],
        '7':[0,4,7,10],'m7':[0,3,7,10],'maj7':[0,4,7,11],'add9':[0,4,7,14],'madd9':[0,3,7,14],'m6':[0,3,7,9],'6':[0,4,7,9]}
MODES = {'major':[0,2,4,5,7,9,11],'minor':[0,2,3,5,7,8,10],'dorian':[0,2,3,5,7,9,10],'harm':[0,2,3,5,7,8,11],
         'phryg':[0,1,3,5,7,8,10],'mixo':[0,2,4,5,7,9,10],'lydian':[0,2,4,6,7,9,11],'whole':[0,2,4,6,8,10],'hijaz':[0,1,4,5,7,8,10]}

def chord(name):
    """'Dm' -> (root pc, [pcs]); 'C/E' slash bass supported."""
    bass = None
    if '/' in name: name, b = name.split('/'); bass = NOTE[b[0]] + (1 if '#' in b else -1 if 'b' in b[1:] else 0)
    r = NOTE[name[0]]; i = 1
    if i < len(name) and name[i] in '#b': r += 1 if name[i] == '#' else -1; i += 1
    q = QUAL[name[i:]]
    return (r % 12, [(r + x) % 12 for x in q], [r + x for x in q], bass if bass is not None else r % 12)

def nearest(pc, around):
    """MIDI note with pitch class pc nearest to `around`."""
    base = around - ((around - pc) % 12)
    return base if around - base <= 6 else base + 12

class Song:
    def __init__(s, bpm, beats=4, seed=1, unit=4):
        s.bpm, s.beats, s.unit = bpm, beats, unit  # unit 4 = quarter beat, 8 = eighth beat (6/8 feel)
        s.tracks = {}; s.rng = random.Random(seed + VAR * 7919); s.prog = {}
        s.bar_ticks = int(TPB * beats * (4 / unit))
    def ch(s, name, program, channel, vol=100, pan=64, rev=60, cho=0, bank=0):
        s.tracks[name] = dict(program=program, channel=channel, vol=vol, pan=pan, rev=rev, cho=cho, bank=bank, notes=[])
        return name
    def note(s, tr, start, dur, pitch, vel, human=True):
        if not (20 <= pitch <= 108): return
        t = s.tracks[tr]
        if human and t['channel'] != 9:
            start += s.rng.randint(-8, 8); vel += s.rng.randint(-6, 6)
        t['notes'].append((max(0, int(start)), max(30, int(dur)), int(pitch), max(1, min(127, int(vel)))))
    # --- layers -------------------------------------------------------------
    def pad(s, tr, prog, bars, low=50, vel=60, n=4, hold=1.0, every=1):
        for b in range(bars[0], bars[1]):
            if (b - bars[0]) % every: continue
            _, pcs, _, bass = chord(prog[b % len(prog)])
            notes = sorted({nearest(pc, low + 7 + 4 * i) for i, pc in enumerate((pcs * 2)[:n])})
            for p in notes: s.note(tr, b * s.bar_ticks, s.bar_ticks * every * hold, p, vel)
    def bass(s, tr, prog, bars, pattern=((0, 4, 0),), octave=36, vel=80):
        """pattern: (beat, dur beats, interval: 0 root, 7 fifth, 12 octave)"""
        bt = s.bar_ticks / s.beats
        for b in range(bars[0], bars[1]):
            r, _, _, bass = chord(prog[b % len(prog)]); root = nearest(bass, octave + 6)
            for beat, d, iv in pattern: s.note(tr, b * s.bar_ticks + beat * bt, d * bt * 0.95, root + iv, vel)
    def arp(s, tr, prog, bars, steps, low=55, vel=62, dur=None, every=1):
        """steps: list of chord-tone indexes (or None) evenly over the bar; index may exceed tones (goes up an octave)."""
        st = s.bar_ticks / len(steps)
        for b in range(bars[0], bars[1]):
            _, pcs, _, _ = chord(prog[b % len(prog)])
            tones = sorted({nearest(pc, low + 6) for pc in pcs})
            for i, k in enumerate(steps):
                if k is None: continue
                p = tones[k % len(tones)] + 12 * (k // len(tones))
                acc = 8 if i == 0 else 0
                s.note(tr, b * s.bar_ticks + i * st, (dur or 1.6) * st, p, vel + acc)
    def hits(s, tr, bars, pattern, every=1):
        """drum pattern: list of (step 0..15 of a 16-grid, note, vel)"""
        st = s.bar_ticks / 16
        for b in range(bars[0], bars[1]):
            if (b - bars[0]) % every: continue
            for step, n, v in pattern: s.note(tr, b * s.bar_ticks + step * st, st * 1.5, n, v + s.rng.randint(-5, 5), human=False)
    def stabs(s, tr, prog, bars, steps, low=55, vel=90, n=3, dur=1.0):
        st = s.bar_ticks / 16
        for b in range(bars[0], bars[1]):
            _, pcs, _, _ = chord(prog[b % len(prog)])
            notes = sorted({nearest(pc, low + 5 + 4 * i) for i, pc in enumerate((pcs * 2)[:n])})
            for k in steps:
                for p in notes: s.note(tr, b * s.bar_ticks + k * st, st * dur * 1.8, p, vel)
    def melody(s, tr, prog, bars, key, mode, rhythms, low=67, high=84, vel=84, phrase=4, cadence=2.0, rest_prob=0.0, seed=None, legato=0.95):
        """Motif melody: per phrase of `phrase` bars uses rhythms[a], rhythms[a], rhythms[b], cadence.
        Strong beats take chord tones, others move by scale step toward the next target."""
        rng = random.Random((seed + VAR * 1000) if seed is not None else s.rng.random())
        scale = sorted({(key + x) % 12 for x in MODES[mode]})
        allowed = [p for p in range(low - 2, high + 3) if p % 12 in scale]
        bt = s.bar_ticks / s.beats
        cur = allowed[len(allowed) // 2]
        motif_cache = {}
        for b in range(bars[0], bars[1]):
            pos = (b - bars[0]) % phrase
            last_phrase = ((b - bars[0]) // phrase) % 2 == 1
            _, pcs, _, _ = chord(prog[b % len(prog)])
            # This bar's pitch set: the mode plus any chromatic chord tones, minus the mode note they replace.
            chroma = [x for x in pcs if x not in scale]
            pcset = (set(scale) | set(pcs)) - {x for x in scale if x not in pcs and any((x - c) % 12 in (1, 11) for c in chroma)}
            allowed = [p for p in range(low - 2, high + 3) if p % 12 in pcset]
            if pos == phrase - 1:
                # cadence: a chord tone held; end of an answer phrase prefers the root
                target_pc = pcs[0] if last_phrase else pcs[min(1, len(pcs) - 1)]
                p = min((x for x in allowed if x % 12 == target_pc), key=lambda x: abs(x - cur))
                rhythm = [(0, cadence)]
                if cadence < s.beats: rhythm = [(0, cadence)]
                for st, d in rhythm: s.note(tr, b * s.bar_ticks + st * bt, d * bt * legato, p, vel - 4)
                cur = p; continue
            r = rhythms[(pos // 2) % len(rhythms)] if pos < 2 else rhythms[(1 + pos) % len(rhythms)]
            key_m = (pos, tuple(r))
            # contour: rise through the phrase, fall in the answer
            direction = 1 if (not last_phrase and pos < 2) else -1 if last_phrase else rng.choice((1, -1))
            for i, (st, d) in enumerate(r):
                if rest_prob and rng.random() < rest_prob and i: continue
                strong = (st % 1 == 0) and (int(st) % 2 == 0)
                if strong:
                    cands = [x for x in allowed if x % 12 in pcs]
                    pref = cur + direction * rng.choice((0, 2, 3, 4))
                    p = min(cands, key=lambda x: abs(x - pref) + (0.5 if x == cur else 0))
                else:
                    idx = allowed.index(min(allowed, key=lambda x: abs(x - cur)))
                    idx = max(0, min(len(allowed) - 1, idx + direction * rng.choice((1, 1, 1, 2))))
                    p = allowed[idx]
                if p > high: p -= 12
                if p < low: p += 12
                s.note(tr, b * s.bar_ticks + st * bt, d * bt * legato, p, vel + (6 if strong else 0))
                cur = p
    def line(s, tr, start_bar, notes, key=0, vel=84, legato=0.95):
        """Hand-written line: list of (beat offset from start bar, beats, midi or None)."""
        bt = s.bar_ticks / s.beats
        for st, d, p in notes:
            if p is None: continue
            s.note(tr, start_bar * s.bar_ticks + st * bt, d * bt * legato, p + key, vel)
    def swell(s, tr, bars, pitch_list, vel=70):
        for b0, b1 in bars:
            for p in pitch_list: s.note(tr, b0 * s.bar_ticks, (b1 - b0) * s.bar_ticks, p, vel)
    # --- output ---------------------------------------------------------------
    def save(s, path, bars_total, tail_bars=2):
        mid = mido.MidiFile(ticks_per_beat=TPB)
        meta = mido.MidiTrack(); mid.tracks.append(meta)
        meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(s.bpm)))
        for name, t in s.tracks.items():
            tr = mido.MidiTrack(); mid.tracks.append(tr); c = t['channel']
            ev = []
            if c != 9:
                if t['bank']: ev.append((0, mido.Message('control_change', channel=c, control=0, value=t['bank'])))
                ev.append((0, mido.Message('program_change', channel=c, program=t['program'])))
            for cc, v in ((7, t['vol']), (10, t['pan']), (91, t['rev']), (93, t['cho'])):
                ev.append((0, mido.Message('control_change', channel=c, control=cc, value=v)))
            end = (bars_total + tail_bars) * s.bar_ticks
            for st, d, p, v in t['notes']:
                if st >= bars_total * s.bar_ticks: continue
                ev.append((st, mido.Message('note_on', channel=c, note=p, velocity=v)))
                ev.append((min(st + d, end - 1), mido.Message('note_off', channel=c, note=p, velocity=0)))
            ev.sort(key=lambda x: (x[0], x[1].type == 'note_on'))
            now = 0
            for at, m in ev: tr.append(m.copy(time=at - now)); now = at
            tr.append(mido.MetaMessage('end_of_track', time=max(0, end - now)))
        mid.save(path)
        return 60 / s.bpm * (s.bar_ticks / TPB) * bars_total
