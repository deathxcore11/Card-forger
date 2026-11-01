# Story mode: three themes for each of the ten acts (MUS-ST-NNA battle, NNB lighter, NNC boss). Each act has one
# hand-written eight-bar leitmotif in the sound of its era and its world (Arabian Nights' oud and frame drums,
# Ice Age's fiddle and war drums, Mirage's kalimba and kora...). The battle theme plays it straight, the lighter
# theme (lessons, comic fights) turns it playful and staccato in a brighter mode, and the boss theme recasts it
# dark and heavy. Form: a bed of bars, the motif on one voice, on a second voice under a counterline, then both.
import engine
from engine import Song, MODES

def I(program, vol=90, pan=64, rev=80): return (program, vol, pan, rev)

def remap(M, key, src, dst):
    """Moves a motif from one mode to another on the same tonic, degree by degree."""
    a, b = MODES[src], MODES[dst]
    out = []
    for bar in M:
        nb = []
        for st, d, p in bar:
            rel = (p - key) % 12
            nb.append((st, d, p - rel + b[a.index(rel)] if rel in a else p))
        out.append(nb)
    return out

def put(s, tr, bar0, M, shift=0, vel=84, legato=0.95):
    for i, notes in enumerate(M):
        s.line(tr, bar0 + i, [(st, d, p + shift) for st, d, p in notes], vel=vel, legato=legato)

# Drum kits (16-step grid; GM percussion on channel 10).
DR = {
 'frame':   [(0, 64, 100), (3, 63, 76), (6, 63, 82), (8, 64, 92), (12, 63, 80), (14, 62, 60)] + [(i, 70, 34) for i in range(0, 16, 2)],
 'clock':   [(i, 76, 30 + (8 if i % 4 == 0 else 0)) for i in range(0, 16, 2)],
 'tabor':   [(0, 45, 96), (8, 45, 84), (4, 37, 64), (12, 37, 70), (2, 54, 44), (6, 54, 48), (10, 54, 44), (14, 54, 52)],
 'norse':   [(0, 36, 100), (6, 41, 82), (8, 36, 90), (10, 41, 78), (12, 43, 86), (14, 41, 70)],
 'africa':  [(0, 64, 100), (3, 63, 80), (6, 63, 84), (8, 62, 66), (10, 64, 92), (12, 63, 78), (14, 62, 60)] + [(i, 69, 34) for i in range(16)] + [(0, 67, 60), (5, 68, 56), (10, 67, 58)],
 'shanty':  [(0, 36, 100), (8, 36, 90), (4, 38, 84), (12, 38, 88), (2, 54, 46), (6, 54, 50), (10, 54, 46), (14, 54, 54)],
 'rig':     [(i, 77, 30) for i in range(1, 16, 2)] + [(12, 52, 70)],
 'machine': [(0, 36, 104), (3, 36, 80), (8, 36, 98), (11, 36, 80), (4, 38, 90), (12, 38, 94)] + [(i, 42, 40) for i in range(16)] + [(6, 67, 58), (14, 67, 62)],
 'bazaar':  [(0, 64, 92), (6, 63, 70), (8, 64, 84), (11, 63, 70), (2, 54, 50), (6, 54, 44), (10, 54, 50), (14, 54, 56), (4, 75, 54), (12, 75, 58)],
 'epic':    [(0, 36, 104), (8, 36, 96), (4, 38, 92), (12, 38, 96), (14, 38, 66), (15, 38, 74), (6, 41, 74), (10, 43, 78)],
 'arena':   [(0, 36, 108), (4, 36, 100), (8, 36, 104), (12, 36, 100), (4, 39, 82), (12, 39, 86)] + [(i, 46, 50) for i in (2, 6, 10, 14)],
 'tribal':  [(0, 41, 104), (3, 43, 80), (6, 41, 92), (8, 45, 88), (10, 43, 84), (12, 41, 96), (14, 45, 76), (4, 75, 56), (12, 75, 60)],
 'light':   [(0, 64, 70), (8, 64, 62), (4, 75, 44), (12, 75, 48)] + [(i, 70, 28) for i in range(0, 16, 2)],
 'march':   [(0, 36, 84), (8, 36, 76), (4, 38, 66), (12, 38, 70), (15, 38, 46)],
 'doom':    [(0, 36, 108), (8, 41, 96), (12, 41, 86)],
 'crash':   [(0, 49, 90)],
 # Three-beat kits (beats fall on steps 0, 5 and 11).
 'w-light': [(0, 64, 74), (5, 63, 50), (11, 63, 54)] + [(i, 70, 28) for i in (0, 3, 5, 8, 11, 13)],
 'w-tabor': [(0, 45, 92), (5, 54, 48), (11, 54, 52), (8, 37, 40)],
 'w-folk':  [(0, 36, 84), (5, 42, 46), (11, 42, 50), (13, 54, 40)],
 'gong':    [(0, 52, 80)],
}

def song(act, kind):
    a = ACTS[act]; k = a[kind]; key = k.get('key', a['key']); beats = k.get('beats', 4)
    s = Song(k['bpm'], beats=beats, seed=act * 31 + ord(kind))
    ch = 0
    for role, spec in k['inst'].items():
        if ch == 9: ch = 10
        prog, vol, pan, rev = spec; s.ch(role, prog, ch, vol=vol, pan=pan, rev=rev); ch += 1
    s.ch('drums', 0, 9, vol=96, rev=50)
    T = 24 if kind == 'B' else 32
    P = k['prog']; M = k['M'] if 'M' in k else remap(a['M'], key, a['mode'], k['mode'])
    tr = s.tracks
    if 'pad' in tr: s.pad('pad', P, (k.get('pad_in', 0), T), low=k.get('pad_low', 50), vel=k.get('pad_vel', 46), n=3)
    if 'choir' in tr: s.pad('choir', P, (8, T), low=55, vel=k.get('choir_vel', 44), n=3)
    if 'bass' in tr: s.bass('bass', P, (0, T), pattern=k.get('bass_pat', ((0, 2, 0), (2, 2, 7))), octave=k.get('bass_oct', 36), vel=k.get('bass_vel', 78))
    if 'low' in tr: s.arp('low', P, (0, T), k.get('low_steps', [0, 0, 1, 0, 0, 0, 2, 0]), low=k.get('low_low', 38), vel=70, dur=.9)
    if 'arp' in tr: s.arp('arp', P, (k.get('arp_in', 0), T), k['arp'], low=k.get('arp_low', 60), vel=k.get('arp_vel', 50), dur=k.get('arp_dur', 1.2))
    if 'arp2' in tr: s.arp('arp2', P, (16, T), k['arp2'], low=k.get('arp2_low', 72), vel=k.get('arp2_vel', 40), dur=1.4)
    if 'stab' in tr: s.stabs('stab', P, (8, T), k.get('stabs', [0, 6, 10]), low=k.get('stab_low', 52), vel=k.get('stab_vel', 80))
    if 'timp' in tr: s.bass('timp', P, (0, T), pattern=k.get('timp_pat', ((0, .5, 0), (2.5, .5, 0), (3, .5, 7))), octave=40, vel=k.get('timp_vel', 82))
    if 'bell' in tr: s.bass('bell', P, (8, T), pattern=((0, 3, 12),), octave=60, vel=46)
    for kit, every in k['drums']: s.hits('drums', (k.get('drum_in', 0), T), DR[kit], every=every)
    la, sa, lb, sb = k['leads']
    if engine.VAR == 1: la, sa, lb, sb = lb, sb, la, sa
    leg = k.get('legato', .95)
    put(s, la, 8, M, sa, vel=88, legato=leg)
    put(s, lb, 16, M, sb, vel=82, legato=leg)
    rh = k.get('rh') or ([[(0, 1), (1, 1), (2, 1)], [(0, 2), (2, 1)]] if beats == 3 else [[(0, 1), (1, 1), (2, 2)], [(0, 1.5), (1.5, .5), (2, 2)]])
    s.melody(la, P, (16, 24), key, k['mode'], rh, low=k.get('ctr_low', 62) + sa, high=k.get('ctr_high', 76) + sa, vel=56, cadence=beats,
             rest_prob=.25, seed=act * 7 + ord(kind), legato=leg)
    if T == 32:
        put(s, la, 24, M, sa, vel=92, legato=leg)
        put(s, lb, 24, M, sb, vel=80, legato=leg)
    yield_to(s, ('lead', 'lead2'), ('pad', 'choir', 'arp', 'arp2', 'stab', 'bell'))
    return s, T, True

def yield_to(s, tunes, beds):
    """The harmony steps aside for the tune: a held bed note a semitone from a sustained melody note sounding over it
    is dropped (the leitmotif was written first, so it wins)."""
    half = s.bar_ticks // (2 * s.beats)
    mel = [n for t in tunes if t in s.tracks for n in s.tracks[t]['notes'] if n[1] >= half]
    for b in beds:
        if b not in s.tracks: continue
        keep = []
        for st, d, p, v in s.tracks[b]['notes']:
            if any(ms < st + d - 20 and st < ms + md - 20 and (mp - p) % 12 in (1, 11) for ms, md, mp, mv in mel): continue
            keep.append((st, d, p, v))
        s.tracks[b]['notes'] = keep

ACTS = {
 # Act 1, The Dawn of Dominaria (1993-94: Alpha, Arabian Nights, Antiquities). Ney flute and santur in D hijaz over
 # frame drums and an oud; the artificers' clockwork ticks under it. Boss: the Brothers' War, tragic, in D minor.
 1: dict(key=2, mode='hijaz', M=[[(0, 1, 74), (1, .5, 75), (1.5, .5, 78), (2, 1, 79), (3, 1, 81)], [(0, 2, 82), (2, 1, 81), (3, 1, 79)],
        [(0, 1, 78), (1, 1, 79), (2, .5, 78), (2.5, .5, 75), (3, 1, 74)], [(0, 4, 74)], [(0, 1, 81), (1, .5, 82), (1.5, .5, 81), (2, 1, 79), (3, 1, 78)],
        [(0, 1, 79), (1, 1, 81), (2, 2, 84)], [(0, 1, 82), (1, 1, 81), (2, 1, 79), (3, 1, 75)], [(0, 4, 74)]],
   A=dict(bpm=112, mode='hijaz', prog=['D', 'D', 'Eb', 'D', 'Gm', 'Cm', 'Eb', 'D'],
          inst=dict(pad=I(49, 70), bass=I(43, 86, 50, 50), arp=I(24, 84, 40, 60), arp2=I(10, 60, 90, 100), lead=I(73, 96, 70, 80), lead2=I(15, 86, 56, 70)),
          arp=[0, None, 1, 2, None, 1, 2, 1], arp_low=50, arp2=[0, None, None, 2, None, None, 1, None], bass_pat=((0, 1, 0), (1.5, .5, 0), (2, 1, 7), (3.5, .5, 0)),
          drums=[('frame', 1), ('clock', 1)], leads=('lead', 0, 'lead2', -12)),
   ),
 # Act 2, Legends and the Dark (1994). A medieval court and a church in shadow: recorder and shawm in A dorian,
 # lute, organ drone, tabor. The lighter theme is an estampie in A mixolydian; Nicol Bolas gets organ, choir and brass.
 2: dict(key=9, mode='dorian', M=[[(0, 1, 69), (1, 1, 72), (2, 1, 74), (3, 1, 76)], [(0, 2, 78), (2, 1, 76), (3, 1, 74)],
        [(0, 1, 72), (1, .5, 74), (1.5, .5, 72), (2, 1, 71), (3, 1, 69)], [(0, 4, 69)], [(0, 1, 76), (1, 1, 79), (2, 1, 78), (3, 1, 76)],
        [(0, 2, 74), (2, 1, 72), (3, 1, 74)], [(0, 1, 76), (1, 1, 74), (2, 1, 72), (3, 1, 71)], [(0, 4, 69)]],
   A=dict(bpm=112, mode='dorian', prog=['Am', 'D', 'Am', 'G', 'Am', 'D', 'Em', 'Am'],
          inst=dict(pad=I(19, 58, 64, 90), bass=I(42, 84, 48, 50), arp=I(24, 84, 38, 60), lead=I(74, 98, 72, 80), lead2=I(68, 90, 56, 80)),
          arp=[0, 1, 2, 1, 0, 1, 2, 1], arp_low=55, drums=[('tabor', 1)], leads=('lead', 0, 'lead2', 0)),
   ),
 # Act 3, Ice Age (1995-96). A frozen north: hardanger-style fiddle and horn over war drums and a low string
 # ostinato, ice glinting on celesta. The lighter theme is a still, snowy flute in E dorian; the necromancer's is
 # organ, choir and tubular bells in E harmonic minor.
 3: dict(key=4, mode='minor', M=[[(0, 1.5, 71), (1.5, .5, 74), (2, 2, 76)], [(0, 1, 79), (1, 1, 78), (2, 1, 76), (3, 1, 74)],
        [(0, 2, 71), (2, 1, 74), (3, 1, 72)], [(0, 4, 71)], [(0, 1.5, 76), (1.5, .5, 79), (2, 2, 83)], [(0, 1, 81), (1, 1, 79), (2, 1, 78), (3, 1, 76)],
        [(0, 2, 74), (2, 1, 72), (3, 1, 71)], [(0, 4, 76)]],
   A=dict(bpm=104, mode='minor', prog=['Em', 'C', 'D', 'Em', 'C', 'G', 'D', 'Em'],
          inst=dict(pad=I(48, 70), low=I(42, 88, 48, 40), arp=I(8, 56, 84, 110), timp=I(47, 90, 64, 70), lead=I(110, 98, 70, 80), lead2=I(60, 92, 52, 80)),
          arp=[0, None, 2, None, 1, None, 3, None], arp_low=79, drums=[('norse', 1), ('crash', 8)], leads=('lead', 0, 'lead2', -12)),
   ),
 # Act 4, Mirage (1996): Jamuraa. Kalimba and kora-like harp in interlocking patterns, flute over talking drums and
 # shakers in G mixolydian. The bazaar's lighter theme is marimba and whistle in G major; the tragic warlord's is
 # taiko, choir and brass in G minor.
 4: dict(key=7, mode='mixo', M=[[(0, .5, 74), (.5, .5, 77), (1, 1, 79), (2, .5, 77), (2.5, .5, 74), (3, 1, 72)], [(0, 1, 74), (1, 1, 71), (2, 2, 67)],
        [(0, .5, 74), (.5, .5, 77), (1, 1, 79), (2, 1, 81), (3, 1, 79)], [(0, 2, 77), (2, 2, 74)], [(0, 1, 79), (1, .5, 81), (1.5, .5, 79), (2, 1, 77), (3, 1, 74)],
        [(0, 1, 72), (1, 1, 74), (2, 2, 77)], [(0, .5, 79), (.5, .5, 77), (1, 1, 74), (2, 1, 72), (3, 1, 71)], [(0, 4, 67)]],
   A=dict(bpm=120, mode='mixo', prog=['G', 'F', 'G', 'C', 'G', 'F', 'C', 'G'],
          inst=dict(pad=I(49, 50), bass=I(32, 90, 50, 40), arp=I(108, 84, 36, 60), arp2=I(46, 70, 90, 80), lead=I(73, 96, 70, 80), lead2=I(12, 90, 56, 70)),
          arp=[0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 0, 3, 1, 2], arp_low=62, arp_dur=.9, arp2=[0, None, 1, 2, None, 1, None, 2], arp2_low=67,
          bass_pat=((0, .75, 0), (.75, .75, 0), (1.5, .5, 7), (2.5, .5, 0), (3, 1, 7)), drums=[('africa', 1)], leads=('lead', 0, 'lead2', 0)),
   ),
 # Act 5, Rath (1997, Tempest): the Weatherlight. A sky-pirate's swagger in D dorian (accordion, fiddle, brass) over
 # rigging creaks and a dark synth bass from the biomechanical plane. Lighter: a comic pirate jig in D mixolydian.
 # Boss: Rath's overlord, organ, choir and grinding metal in D phrygian.
 5: dict(key=2, mode='dorian', M=[[(0, 1, 69), (1, .5, 69), (1.5, .5, 72), (2, 1, 74), (3, 1, 77)], [(0, 1.5, 76), (1.5, .5, 74), (2, 2, 72)],
        [(0, 1, 71), (1, 1, 74), (2, 1, 79), (3, 1, 77)], [(0, 2, 76), (2, 2, 74)], [(0, 1, 81), (1, .5, 79), (1.5, .5, 77), (2, 1, 76), (3, 1, 74)],
        [(0, 1, 72), (1, 1, 76), (2, 2, 79)], [(0, 1, 77), (1, 1, 76), (2, 1, 72), (3, 1, 71)], [(0, 4, 74)]],
   A=dict(bpm=126, mode='dorian', prog=['Dm', 'C', 'Dm', 'G', 'Dm', 'C', 'Am', 'Dm'],
          inst=dict(bass=I(38, 84, 64, 40), arp=I(45, 80, 40, 60), stab=I(61, 84, 60, 70), lead=I(21, 96, 70, 70), lead2=I(110, 94, 56, 70)),
          arp=[0, 1, 2, 1, 0, 1, 2, 1], arp_low=55, bass_pat=((0, .5, 0), (.5, .5, 12), (1, .5, 0), (2, .5, 0), (2.5, .5, 12), (3, .5, 7)),
          stabs=[0, 6, 10], drums=[('shanty', 1), ('rig', 1), ('crash', 8)], leads=('lead', 0, 'lead2', 0)),
   ),
 # Act 6, Urza's Saga (1998): the Phyrexian war machine against the Tolarian Academy. Driving string ostinato,
 # trumpet and industrial drums in B harmonic minor. Lighter: the Academy, harpsichord, clarinet and celesta in
 # B major. Boss: Phyrexia itself, choir, organ, trombones and taiko in B phrygian.
 6: dict(key=11, mode='harm', M=[[(0, .5, 71), (.5, .5, 74), (1, .5, 78), (1.5, .5, 74), (2, 1, 79), (3, 1, 78)], [(0, 2, 76), (2, 1, 74), (3, 1, 73)],
        [(0, .5, 71), (.5, .5, 74), (1, .5, 78), (1.5, .5, 74), (2, 1, 81), (3, 1, 79)], [(0, 4, 78)], [(0, 1, 83), (1, 1, 81), (2, 1, 79), (3, 1, 78)],
        [(0, 1, 79), (1, 1, 78), (2, 1, 76), (3, 1, 74)], [(0, 2, 73), (2, 1, 74), (3, 1, 70)], [(0, 4, 71)]],
   A=dict(bpm=132, mode='harm', prog=['Bm', 'G', 'A', 'Bm', 'Bm', 'G', 'F#', 'Bm'],
          inst=dict(pad=I(48, 66), low=I(48, 88, 48, 40), bass=I(38, 80, 64, 30), stab=I(61, 84, 60, 70), timp=I(47, 90, 64, 70), lead=I(56, 96, 70, 70), lead2=I(60, 94, 52, 70)),
          low_steps=[0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 0, 1], low_low=47, bass_pat=((0, .5, 0), (1, .5, 0), (2, .5, 0), (3, .5, 0)),
          stabs=[0, 6, 10, 14], drums=[('machine', 1), ('crash', 8)], leads=('lead', 0, 'lead2', -12)),
   ),
 # Act 7, Mercadian Masques (1999): a city of merchants and masks. Intrigue on pizzicato, clarinet and santur in E
 # harmonic minor with castanet-and-tambourine percussion. Lighter: a quick bazaar tarantella in E major. Boss:
 # the city's hidden master, brass and choir in E harmonic minor.
 7: dict(key=4, mode='harm', M=[[(0, .5, 64), (.5, .5, 67), (1, .5, 71), (1.5, .5, 72), (2, 1, 71), (3, .5, 67), (3.5, .5, 63)], [(0, 2, 64), (2, 1, 66), (3, 1, 67)],
        [(0, 1, 69), (1, .5, 72), (1.5, .5, 71), (2, 1, 69), (3, 1, 66)], [(0, 4, 71)], [(0, .5, 76), (.5, .5, 75), (1, 1, 76), (2, 1, 72), (3, 1, 71)],
        [(0, 1, 69), (1, 1, 72), (2, 2, 76)], [(0, 1, 75), (1, 1, 72), (2, 1, 71), (3, 1, 66)], [(0, 4, 64)]],
   A=dict(bpm=116, mode='harm', prog=['Em', 'Am', 'B', 'Em', 'C', 'Am', 'B7', 'Em'],
          inst=dict(pad=I(49, 56), bass=I(45, 86, 44, 50), arp=I(15, 80, 36, 70), lead=I(71, 96, 70, 70), lead2=I(73, 90, 56, 80)),
          arp=[0, 1, 2, 1, 0, 1, 2, 3], arp_low=64, bass_pat=((0, .5, 0), (1, .5, 7), (2, .5, 0), (3, .5, 7)), drums=[('bazaar', 1)], leads=('lead', 0, 'lead2', 12)),
   ),
 # Act 8, Invasion (2000): the Phyrexian invasion of Dominaria. Full-orchestra war in D minor: string ostinato, horns,
 # trumpets, choir, snare and timpani. Lighter: a noble horn hymn in D major. Boss: choir, organ and brass in D phrygian.
 8: dict(key=2, mode='minor', M=[[(0, 1, 62), (1, .5, 65), (1.5, .5, 69), (2, 2, 74)], [(0, 1, 72), (1, 1, 70), (2, 2, 69)],
        [(0, 1, 65), (1, .5, 69), (1.5, .5, 72), (2, 2, 77)], [(0, 1, 76), (1, 1, 74), (2, 2, 72)], [(0, 1, 74), (1, .5, 77), (1.5, .5, 81), (2, 2, 82)],
        [(0, 1, 81), (1, 1, 77), (2, 2, 74)], [(0, 1, 70), (1, 1, 74), (2, 1, 79), (3, 1, 77)], [(0, 4, 76)]],
   A=dict(bpm=140, mode='minor', prog=['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
          inst=dict(low=I(48, 90, 48, 40), choir=I(52, 74, 64, 110), stab=I(61, 86, 60, 70), timp=I(47, 96, 64, 70), lead=I(60, 98, 52, 80), lead2=I(56, 94, 72, 70)),
          low_steps=[0, 0, 1, 0, 0, 0, 2, 0], low_low=38, stabs=[0, 6, 10], drums=[('epic', 1), ('crash', 4)], leads=('lead', 0, 'lead2', 0)),
   ),
 # Act 9, Odyssey (2001): the Cabal's pit fights. A driving arena beat with power-chord guitar, brass and synth bass
 # in E minor. Lighter: an announcer's brass-band swagger in E dorian. Boss: the Cabal's church, organ, choir and bell
 # in E phrygian.
 9: dict(key=4, mode='minor', M=[[(0, .5, 64), (.5, .5, 64), (1, .5, 67), (1.5, .5, 64), (2, .5, 69), (2.5, .5, 67), (3, 1, 64)], [(0, .5, 71), (.5, .5, 69), (1, 1, 67), (2, 2, 64)],
        [(0, .5, 64), (.5, .5, 64), (1, .5, 67), (1.5, .5, 64), (2, .5, 71), (2.5, .5, 72), (3, 1, 71)], [(0, 2, 69), (2, 2, 67)], [(0, 1, 76), (1, .5, 74), (1.5, .5, 71), (2, 1, 74), (3, 1, 76)],
        [(0, 1, 79), (1, 1, 76), (2, 2, 74)], [(0, .5, 71), (.5, .5, 72), (1, 1, 71), (2, 1, 69), (3, 1, 67)], [(0, 4, 64)]],
   A=dict(bpm=128, mode='minor', prog=['E5', 'E5', 'G5', 'A5', 'E5', 'E5', 'C5', 'D5'],
          inst=dict(stab=I(30, 76, 44, 40), bass=I(38, 90, 64, 30), timp=I(47, 86, 64, 60), lead=I(61, 96, 64, 70), lead2=I(56, 92, 72, 70)),
          stabs=[0, 3, 6, 8, 11, 14], stab_low=40, bass_pat=((0, .5, 0), (.5, .5, 0), (1, .5, 12), (1.5, .5, 0), (2, .5, 0), (2.5, .5, 0), (3, .5, 12), (3.5, .5, 0)),
          drums=[('arena', 1), ('crash', 8)], leads=('lead', 12, 'lead2', 12), ctr_low=64, ctr_high=79),
   ),
 # Act 10, Onslaught (2002): Otaria's tribes and a false god. Tribal toms, horn and pan flute over a taiko bass in A
 # minor pentatonic. Lighter: marimba and flute in A major. Boss: the false god's hymn, choir and organ in A
 # harmonic minor, swelling with timpani and bells.
 10: dict(key=9, mode='minor', M=[[(0, 1, 69), (1, .5, 72), (1.5, .5, 74), (2, 1, 76), (3, 1, 74)], [(0, 1, 72), (1, 1, 69), (2, 2, 67)],
        [(0, 1, 69), (1, .5, 72), (1.5, .5, 74), (2, 1, 76), (3, 1, 79)], [(0, 4, 76)], [(0, 1, 81), (1, 1, 79), (2, 1, 76), (3, 1, 74)],
        [(0, 1, 76), (1, 1, 74), (2, 2, 72)], [(0, 1, 74), (1, 1, 72), (2, 1, 69), (3, 1, 67)], [(0, 4, 69)]],
   A=dict(bpm=132, mode='minor', prog=['Am', 'Am', 'G', 'Am', 'F', 'G', 'Em', 'Am'],
          inst=dict(pad=I(53, 64, 64, 100), bass=I(116, 96, 50, 60), lead=I(60, 98, 52, 80), lead2=I(75, 92, 72, 80)),
          bass_pat=((0, .5, 0), (1.5, .5, 0), (2, .5, 7), (3, .5, 0)), bass_oct=40, drums=[('tribal', 1), ('crash', 8)], leads=('lead', 0, 'lead2', 0)),
   ),
}

# The lighter and boss themes are songs of their own: their own tune, key, meter and band, written for what happens in
# those fights (Randall, 1 Nov: "a literal different song and vibe").
W = ((0, 1, 0), (1, 1, 7), (2, 1, 7))  # three-beat oom-pah bass
LIGHT_BOSS = {
 # Act 1. Lighter: the bored djinn and the Goblin King's toll, a sly 3/4 snake-charmer tune in G harmonic minor on
 # clarinet and bassoon. Boss: the Brothers' War, a slow lament in D minor for violin and horn over choir and clockwork.
 1: (dict(bpm=126, beats=3, key=7, mode='harm', legato=.55, prog=['Gm', 'D', 'Gm', 'D', 'Cm', 'Gm', 'D', 'Gm'],
          M=[[(0, 1, 67), (1, .5, 70), (1.5, .5, 69), (2, 1, 67)], [(0, 1, 66), (1, 1, 69), (2, 1, 74)], [(0, 1, 75), (1, .5, 74), (1.5, .5, 72), (2, 1, 70)], [(0, 3, 69)],
             [(0, 1, 74), (1, .5, 75), (1.5, .5, 74), (2, 1, 72)], [(0, 1, 70), (1, 1, 67), (2, 1, 63)], [(0, 1, 62), (1, 1, 66), (2, 1, 69)], [(0, 3, 67)]],
          inst=dict(bass=I(45, 84, 44, 50), arp=I(10, 60, 84, 90), lead=I(71, 96, 66, 70), lead2=I(70, 90, 50, 70)),
          arp=[0, None, 2, None, 1, None], arp_low=74, bass_pat=W, drums=[('w-light', 1)], leads=('lead', 0, 'lead2', -12)),
     dict(bpm=76, key=2, mode='harm', prog=['Dm', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'A', 'Dm'],
          M=[[(0, 2, 74), (2, 1, 77), (3, 1, 76)], [(0, 3, 74), (3, 1, 73)], [(0, 2, 70), (2, 1, 69), (3, 1, 67)], [(0, 4, 69)],
             [(0, 2, 77), (2, 1, 81), (3, 1, 79)], [(0, 2, 77), (2, 1, 76), (3, 1, 74)], [(0, 2, 73), (2, 1, 74), (3, 1, 76)], [(0, 4, 74)]],
          inst=dict(pad=I(48, 76), choir=I(52, 74, 64, 110), bass=I(58, 84, 54, 60), timp=I(47, 96, 64, 70), lead=I(40, 96, 70, 90), lead2=I(60, 92, 50, 90)),
          drums=[('doom', 2), ('clock', 1), ('crash', 8)], leads=('lead', 0, 'lead2', -12), ctr_low=64, ctr_high=79)),
 # Act 2. Lighter: a galliard for the court in 3/4, G mixolydian, recorder and lute with tabor. Boss: Nicol Bolas, a
 # brutal E phrygian march of brass, choir and organ.
 2: (dict(bpm=132, beats=3, key=7, mode='mixo', legato=.7, prog=['G', 'D', 'G', 'C', 'F', 'C', 'D', 'G'],
          M=[[(0, 1, 74), (1, 1, 72), (2, 1, 71)], [(0, 2, 69), (2, 1, 67)], [(0, 1, 71), (1, 1, 72), (2, 1, 74)], [(0, 3, 76)],
             [(0, 1, 77), (1, 1, 76), (2, 1, 74)], [(0, 1, 72), (1, 1, 71), (2, 1, 69)], [(0, 1, 71), (1, .5, 69), (1.5, .5, 71), (2, 1, 72)], [(0, 3, 67)]],
          inst=dict(bass=I(110, 56, 40, 60), arp=I(24, 84, 38, 60), lead=I(74, 98, 72, 80), lead2=I(68, 84, 56, 80)),
          arp=[0, 2, 1, 2, 0, 2], arp_low=55, bass_pat=((0, 3, 0), (0, 3, 7)), bass_oct=48, bass_vel=48, drums=[('w-tabor', 1)], leads=('lead', 0, 'lead2', 0)),
     dict(bpm=120, key=4, mode='phryg', prog=['Em', 'Em', 'Am', 'Em', 'Am', 'F', 'Dm', 'Em'],
          M=[[(0, 1, 64), (1, 1, 65), (2, 2, 64)], [(0, 1, 71), (1, 1, 72), (2, 2, 71)], [(0, .5, 76), (.5, .5, 77), (1, 1, 76), (2, 1, 74), (3, 1, 72)], [(0, 4, 71)],
             [(0, 1, 64), (1, 1, 65), (2, 1, 67), (3, 1, 69)], [(0, 2, 72), (2, 2, 69)], [(0, 1, 74), (1, 1, 72), (2, 1, 71), (3, 1, 69)], [(0, 4, 64)]],
          inst=dict(pad=I(19, 74, 64, 90), choir=I(52, 80, 64, 110), bass=I(58, 86, 54, 60), stab=I(61, 84, 60, 70), timp=I(47, 96, 64, 70), lead=I(57, 96, 50, 80), lead2=I(48, 94, 72, 80)),
          stabs=[0, 3, 6, 10, 12], drums=[('epic', 1), ('crash', 4)], leads=('lead', 0, 'lead2', 12), ctr_low=64, ctr_high=79)),
 # Act 3. Lighter: snowfall, a slow 3/4 in C lydian for flute, harp and celesta. Boss: the necromancer, C# harmonic
 # minor, organ, choir, tolling bells and trombone.
 3: (dict(bpm=84, beats=3, key=0, mode='lydian', legato=.9, prog=['C', 'D', 'C', 'D', 'Em', 'D', 'D', 'C'],
          M=[[(0, 2, 76), (2, 1, 79)], [(0, 1, 78), (1, 1, 76), (2, 1, 74)], [(0, 3, 72)], [(0, 2, 74), (2, 1, 76)],
             [(0, 2, 79), (2, 1, 81)], [(0, 1, 83), (1, 1, 81), (2, 1, 79)], [(0, 2, 78), (2, 1, 74)], [(0, 3, 76)]],
          inst=dict(pad=I(49, 64), arp=I(46, 80, 40, 90), arp2=I(8, 54, 86, 110), lead=I(73, 96, 70, 90), lead2=I(42, 80, 50, 90)),
          arp=[0, 1, 2, 3, 2, 1], arp_low=55, arp2=[None, None, 2, None, 3, None], drums=[], leads=('lead', 0, 'lead2', -24)),
     dict(bpm=92, key=1, mode='harm', prog=['C#m', 'G#', 'C#m', 'F#m', 'C#m', 'A', 'G#', 'C#m'],
          M=[[(0, 1, 73), (1, 1, 76), (2, 1, 75), (3, 1, 73)], [(0, 2, 72), (2, 2, 73)], [(0, 1, 80), (1, 1, 81), (2, 1, 80), (3, 1, 76)], [(0, 4, 78)],
             [(0, 1, 73), (1, 1, 76), (2, 1, 80), (3, 1, 85)], [(0, 2, 85), (2, 2, 81)], [(0, 1, 80), (1, 1, 78), (2, 1, 76), (3, 1, 75)], [(0, 4, 73)]],
          inst=dict(pad=I(19, 70, 64, 100), choir=I(52, 80, 64, 110), low=I(43, 90, 50, 40), timp=I(47, 96, 64, 70), bell=I(14, 70, 80, 110), lead=I(57, 96, 52, 80), lead2=I(48, 92, 72, 80)),
          low_low=34, drums=[('doom', 1), ('gong', 8)], leads=('lead', -12, 'lead2', 0), ctr_low=64, ctr_high=79)),
 # Act 4. Lighter: the bazaar and Teferi's phasing isle, a bright 3/4 in D major on marimba, kalimba and whistle. Boss:
 # the tragic warlord, C harmonic minor, taiko, choir, horn and brass.
 4: (dict(bpm=132, beats=3, key=2, mode='major', legato=.55, prog=['D', 'Bm', 'A', 'A', 'D', 'D', 'A', 'D'],
          M=[[(0, .5, 74), (.5, .5, 76), (1, 1, 78), (2, 1, 81)], [(0, 1, 78), (1, 1, 74), (2, 1, 71)], [(0, .5, 73), (.5, .5, 74), (1, 1, 76), (2, 1, 79)], [(0, 3, 76)],
             [(0, .5, 74), (.5, .5, 76), (1, 1, 78), (2, 1, 83)], [(0, 1, 81), (1, 1, 78), (2, 1, 74)], [(0, 1, 76), (1, 1, 73), (2, 1, 69)], [(0, 3, 74)]],
          inst=dict(bass=I(32, 86, 50, 40), arp=I(108, 80, 36, 60), lead=I(12, 98, 66, 70), lead2=I(78, 80, 56, 80)),
          arp=[0, 2, 1, 2, 0, 2], arp_low=62, bass_pat=W, drums=[('w-light', 1)], leads=('lead', 0, 'lead2', 0)),
     dict(bpm=96, key=0, mode='harm', prog=['Cm', 'G', 'Cm', 'G', 'Cm', 'Fm', 'G', 'Cm'],
          M=[[(0, 2, 67), (2, 1, 68), (3, 1, 67)], [(0, 1, 65), (1, 1, 63), (2, 2, 62)], [(0, 2, 72), (2, 1, 74), (3, 1, 75)], [(0, 4, 74)],
             [(0, 1, 79), (1, 1, 80), (2, 1, 79), (3, 1, 75)], [(0, 2, 77), (2, 1, 75), (3, 1, 74)], [(0, 1, 75), (1, 1, 74), (2, 1, 72), (3, 1, 71)], [(0, 4, 72)]],
          inst=dict(pad=I(48, 76), choir=I(52, 78, 64, 110), bass=I(116, 96, 50, 60), stab=I(61, 82, 60, 70), timp=I(47, 92, 64, 70), lead=I(60, 96, 52, 80), lead2=I(48, 92, 72, 80)),
          bass_pat=((0, .5, 0), (1.5, .5, 0), (3, .5, 0)), bass_oct=40, stabs=[0, 10], drums=[('africa', 2), ('doom', 1), ('crash', 8)], leads=('lead', 0, 'lead2', 0), ctr_high=79)),
 # Act 5. Lighter: a 3/4 sea-jig in F major for bassoon, accordion and fiddle. Boss: Rath's overlord, C phrygian:
 # a grinding synth bass, organ, choir, trombone and metal.
 5: (dict(bpm=126, beats=3, key=5, mode='major', legato=.55, prog=['F', 'F', 'C', 'C', 'F', 'Bb', 'C', 'F'],
          M=[[(0, 1, 72), (1, .5, 77), (1.5, .5, 76), (2, 1, 74)], [(0, 1, 72), (1, 1, 69), (2, 1, 65)], [(0, 1, 67), (1, .5, 70), (1.5, .5, 69), (2, 1, 67)], [(0, 3, 67)],
             [(0, 1, 72), (1, .5, 77), (1.5, .5, 76), (2, 1, 74)], [(0, 1, 74), (1, 1, 72), (2, 1, 70)], [(0, 1, 77), (1, 1, 72), (2, 1, 67)], [(0, 3, 65)]],
          inst=dict(bass=I(58, 80, 50, 50), arp=I(21, 70, 40, 60), lead=I(70, 96, 66, 70), lead2=I(110, 88, 56, 70)),
          arp=[None, 1, 2, None, 1, 2], arp_low=60, bass_pat=W, drums=[('w-folk', 1)], leads=('lead', -12, 'lead2', 0)),
     dict(bpm=100, key=0, mode='phryg', prog=['Cm', 'Cm', 'Cm', 'Cm', 'Ab', 'Db', 'Cm', 'Cm'],
          M=[[(0, 1, 60), (1, 1, 61), (2, 1, 60), (3, 1, 67)], [(0, 2, 68), (2, 2, 67)], [(0, 1, 72), (1, 1, 73), (2, 1, 72), (3, 1, 70)], [(0, 4, 67)],
             [(0, 1, 75), (1, 1, 73), (2, 1, 72), (3, 1, 70)], [(0, 2, 68), (2, 2, 65)], [(0, 1, 67), (1, 1, 68), (2, 1, 67), (3, 1, 61)], [(0, 4, 60)]],
          inst=dict(pad=I(19, 76, 64, 100), choir=I(52, 74, 64, 110), bass=I(38, 92, 64, 40), stab=I(55, 66, 64, 70), timp=I(47, 92, 64, 70), lead=I(57, 96, 52, 80), lead2=I(48, 92, 72, 80)),
          bass_pat=((0, .5, 0), (.5, .5, 0), (1.5, .5, 0), (2, .5, 1), (3, 1, 0)), stabs=[0, 12], drums=[('machine', 1), ('rig', 1), ('gong', 8)], leads=('lead', 0, 'lead2', 12), ctr_low=60, ctr_high=75)),
 # Act 6. Lighter: the Tolarian Academy, a quick 3/4 scherzo in F major for clarinet, harpsichord and celesta. Boss:
 # Phyrexia, a crawling F# phrygian dirge for low strings, choir, organ and trombones.
 6: (dict(bpm=132, beats=3, key=5, mode='major', legato=.6, prog=['F', 'Gm', 'F', 'C', 'Bb', 'F', 'C7', 'F'],
          M=[[(0, .5, 72), (.5, .5, 74), (1, .5, 72), (1.5, .5, 69), (2, 1, 65)], [(0, 1, 67), (1, 1, 70), (2, 1, 74)], [(0, .5, 72), (.5, .5, 74), (1, .5, 72), (1.5, .5, 69), (2, 1, 77)], [(0, 3, 76)],
             [(0, 1, 77), (1, 1, 74), (2, 1, 70)], [(0, 1, 72), (1, 1, 69), (2, 1, 65)], [(0, 1, 67), (1, 1, 70), (2, 1, 64)], [(0, 3, 65)]],
          inst=dict(bass=I(45, 80, 44, 50), arp=I(6, 70, 36, 60), arp2=I(8, 56, 88, 100), lead=I(71, 96, 66, 70), lead2=I(73, 86, 56, 80)),
          arp=[0, 1, 2, 3, 2, 1], arp_low=57, arp2=[0, None, 2, None, 3, None], bass_pat=W, drums=[('clock', 1)], leads=('lead', 0, 'lead2', 12)),
     dict(bpm=88, key=6, mode='phryg', prog=['F#m', 'G', 'Bm', 'F#m', 'F#m', 'G', 'Em', 'F#m'],
          M=[[(0, 2, 66), (2, 2, 67)], [(0, 2, 66), (2, 1, 64), (3, 1, 62)], [(0, 2, 61), (2, 2, 62)], [(0, 4, 61)],
             [(0, 2, 73), (2, 2, 74)], [(0, 2, 73), (2, 1, 71), (3, 1, 69)], [(0, 2, 67), (2, 1, 69), (3, 1, 67)], [(0, 4, 66)]],
          inst=dict(pad=I(19, 78, 64, 100), choir=I(52, 82, 64, 110), bass=I(58, 88, 54, 60), stab=I(57, 84, 58, 70), timp=I(47, 96, 64, 70), lead=I(48, 94, 72, 80), lead2=I(61, 94, 52, 80)),
          stabs=[0, 3, 8], drums=[('doom', 1), ('machine', 2), ('gong', 8)], leads=('lead', 12, 'lead2', 0), ctr_low=60, ctr_high=74)),
 # Act 7. Lighter: a fast 3/4 tarantella through the market, A major, santur, piccolo and accordion. Boss: the city's
 # hidden master, a dark tango in D harmonic minor for violin, brass and castanets.
 7: (dict(bpm=152, beats=3, key=9, mode='major', legato=.5, prog=['A', 'E', 'A', 'A', 'E', 'A', 'E', 'A'],
          M=[[(0, 1, 76), (1, 1, 73), (2, 1, 69)], [(0, 1, 71), (1, 1, 73), (2, 1, 74)], [(0, 1, 76), (1, 1, 78), (2, 1, 76)], [(0, 3, 73)],
             [(0, 1, 74), (1, 1, 71), (2, 1, 68)], [(0, 1, 69), (1, 1, 71), (2, 1, 73)], [(0, 1, 74), (1, 1, 73), (2, 1, 71)], [(0, 3, 69)]],
          inst=dict(bass=I(58, 76, 50, 50), arp=I(21, 72, 40, 60), lead=I(15, 96, 66, 70), lead2=I(72, 82, 56, 80)),
          arp=[0, 1, 2, 0, 1, 2], arp_low=60, bass_pat=W, drums=[('w-light', 1)], leads=('lead', 0, 'lead2', 12)),
     dict(bpm=98, key=2, mode='harm', prog=['Dm', 'A', 'Gm', 'A', 'Dm', 'Gm', 'A', 'Dm'],
          M=[[(0, 1.5, 74), (1.5, .5, 73), (2, 1, 74), (3, 1, 77)], [(0, 1.5, 76), (1.5, .5, 74), (2, 2, 73)], [(0, 1.5, 70), (1.5, .5, 69), (2, 1, 70), (3, 1, 74)], [(0, 4, 69)],
             [(0, 1.5, 77), (1.5, .5, 76), (2, 1, 77), (3, 1, 81)], [(0, 1.5, 79), (1.5, .5, 77), (2, 2, 76)], [(0, 1, 74), (1, 1, 73), (2, 1, 70), (3, 1, 69)], [(0, 4, 74)]],
          inst=dict(pad=I(48, 70), choir=I(52, 70, 64, 110), bass=I(45, 90, 44, 50), stab=I(61, 86, 60, 70), lead=I(40, 98, 70, 80), lead2=I(57, 92, 52, 80)),
          bass_pat=((0, .75, 0), (.75, .25, 0), (1, .5, 7), (2, .5, 0), (3, .5, 7)), stabs=[0, 3, 6, 12],
          drums=[('bazaar', 1), ('doom', 2)], leads=('lead', 0, 'lead2', -12), ctr_low=64, ctr_high=79)),
 # Act 8. Lighter: a noble hymn in 3/4, B-flat major, horns, strings and harp. Boss: the invasion's terror, B-flat
 # harmonic minor at full force, brass, choir, organ and war drums.
 8: (dict(bpm=88, beats=3, key=10, mode='major', legato=.9, prog=['Bb', 'Bb', 'Eb', 'F', 'Bb', 'Bb', 'F', 'Bb'],
          M=[[(0, 2, 70), (2, 1, 72)], [(0, 1, 74), (1, 1, 72), (2, 1, 70)], [(0, 2, 75), (2, 1, 74)], [(0, 3, 72)],
             [(0, 2, 77), (2, 1, 75)], [(0, 1, 74), (1, 1, 72), (2, 1, 70)], [(0, 2, 72), (2, 1, 69)], [(0, 3, 70)]],
          inst=dict(pad=I(49, 70), bass=I(42, 76, 48, 70), arp=I(46, 76, 40, 90), lead=I(60, 96, 56, 90), lead2=I(48, 86, 72, 90)),
          arp=[0, 1, 2, 3, 2, 1], arp_low=58, bass_pat=((0, 3, 0),), drums=[('w-folk', 2)], leads=('lead', -12, 'lead2', 0)),
     dict(bpm=120, key=10, mode='harm', prog=['Bbm', 'F', 'Gb', 'F', 'Bbm', 'Gb', 'F', 'Bbm'],
          M=[[(0, 1, 70), (1, 1, 73), (2, 1, 77), (3, 1, 82)], [(0, 2, 81), (2, 2, 77)], [(0, 1, 78), (1, 1, 77), (2, 1, 75), (3, 1, 73)], [(0, 4, 72)],
             [(0, 1, 70), (1, 1, 73), (2, 1, 77), (3, 1, 82)], [(0, 2, 85), (2, 2, 82)], [(0, 1, 81), (1, 1, 82), (2, 1, 81), (3, 1, 77)], [(0, 4, 70)]],
          inst=dict(pad=I(19, 78, 64, 100), choir=I(52, 84, 64, 110), low=I(43, 90, 50, 40), stab=I(61, 88, 60, 70), timp=I(47, 98, 64, 70), lead=I(56, 96, 52, 80), lead2=I(48, 94, 72, 80)),
          stabs=[0, 3, 6, 10, 12], drums=[('epic', 1), ('doom', 2), ('crash', 4)], leads=('lead', 0, 'lead2', -12), ctr_low=64, ctr_high=81)),
 # Act 9. Lighter: the pit announcer's brass band, an oom-pah march in C major. Boss: the Cabal's church, a C# phrygian
 # rite for trombone, choir, organ and bell.
 9: (dict(bpm=120, key=0, mode='major', legato=.55, prog=['C', 'F', 'C', 'G', 'F', 'C', 'G', 'C'],
          M=[[(0, .5, 67), (.5, .5, 72), (1, 1, 76), (2, .5, 74), (2.5, .5, 72), (3, 1, 67)], [(0, 1, 69), (1, 1, 71), (2, 2, 72)], [(0, .5, 67), (.5, .5, 72), (1, 1, 76), (2, .5, 79), (2.5, .5, 77), (3, 1, 76)], [(0, 4, 74)],
             [(0, 1, 77), (1, 1, 76), (2, 1, 74), (3, 1, 72)], [(0, 1, 76), (1, 1, 74), (2, 2, 72)], [(0, 1, 74), (1, 1, 72), (2, 1, 71), (3, 1, 67)], [(0, 4, 72)]],
          inst=dict(bass=I(58, 88, 50, 50), stab=I(61, 72, 60, 60), lead=I(56, 96, 66, 70), lead2=I(71, 86, 56, 70)),
          stabs=[4, 12], bass_pat=((0, 1, 0), (2, 1, 7)), drums=[('march', 1)], leads=('lead', 0, 'lead2', 0)),
     dict(bpm=100, key=1, mode='phryg', prog=['C#m', 'D', 'C#m', 'C#m', 'A', 'D', 'Bm', 'C#m'],
          M=[[(0, 2, 61), (2, 2, 62)], [(0, 1, 64), (1, 1, 62), (2, 2, 61)], [(0, 2, 68), (2, 2, 69)], [(0, 4, 68)],
             [(0, 1, 73), (1, 1, 74), (2, 1, 73), (3, 1, 71)], [(0, 2, 69), (2, 2, 68)], [(0, 1, 66), (1, 1, 64), (2, 1, 62), (3, 1, 64)], [(0, 4, 61)]],
          inst=dict(pad=I(19, 80, 64, 100), choir=I(52, 82, 64, 110), bass=I(38, 90, 64, 30), bell=I(14, 74, 80, 110), timp=I(47, 96, 64, 70), lead=I(57, 96, 52, 80), lead2=I(48, 94, 72, 80)),
          drums=[('doom', 1), ('gong', 8)], leads=('lead', 0, 'lead2', 12), ctr_low=60, ctr_high=74)),
 # Act 10. Lighter: a hunting song in 3/4, D major pentatonic, marimba, flute and hand drums. Boss: the false god's hymn,
 # F minor, a choir that swells with organ, timpani and bells.
 10: (dict(bpm=112, beats=3, key=2, mode='major', legato=.6, prog=['D', 'D', 'G', 'A', 'D', 'D', 'A', 'D'],
          M=[[(0, 1, 74), (1, 1, 76), (2, 1, 78)], [(0, 2, 81), (2, 1, 78)], [(0, 1, 76), (1, 1, 74), (2, 1, 71)], [(0, 3, 76)],
             [(0, 1, 78), (1, 1, 81), (2, 1, 83)], [(0, 2, 81), (2, 1, 78)], [(0, 1, 76), (1, 1, 78), (2, 1, 76)], [(0, 3, 74)]],
          inst=dict(bass=I(116, 80, 50, 60), arp=I(12, 74, 40, 70), lead=I(73, 96, 66, 80), lead2=I(12, 88, 56, 70)),
          arp=[0, 2, 1, 2, 0, 2], arp_low=57, bass_pat=W, bass_oct=40, drums=[('w-light', 1)], leads=('lead', 0, 'lead2', 0)),
      dict(bpm=72, key=5, mode='minor', prog=['Fm', 'Fm', 'Db', 'C', 'Ab', 'Ab', 'Bbm', 'Fm'],
          M=[[(0, 2, 65), (2, 2, 68)], [(0, 2, 72), (2, 2, 70)], [(0, 2, 68), (2, 1, 67), (3, 1, 65)], [(0, 4, 67)],
             [(0, 2, 72), (2, 2, 73)], [(0, 2, 75), (2, 2, 72)], [(0, 2, 70), (2, 1, 68), (3, 1, 67)], [(0, 4, 65)]],
          inst=dict(pad=I(19, 80, 64, 100), choir=I(52, 86, 64, 110), bass=I(43, 86, 50, 50), timp=I(47, 96, 64, 70), bell=I(14, 70, 80, 110), lead=I(52, 92, 64, 110), lead2=I(57, 94, 52, 80)),
          timp_pat=((0, 1, 0), (3, .5, 7)), drums=[('doom', 2), ('gong', 8)], leads=('lead', 0, 'lead2', -12), ctr_low=64, ctr_high=79)),
}
for _n, (_b, _c) in LIGHT_BOSS.items(): ACTS[_n]['B'], ACTS[_n]['C'] = _b, _c

STORY = {f'MUS-ST-{a:02d}{k}': (lambda a=a, k=k: song(a, k)) for a in ACTS for k in 'ABC'}
