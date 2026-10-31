# CardStashy original score. Each function builds one cue and returns (Song, bars, loop).
import engine
from engine import Song, chord

# The wandering theme (D dorian, 6/8, eighth-note beats). Shared by the title and quoted in the act maps.
THEME_A = [  # (start eighth, length eighths, midi) per bar, bar offsets added below
    [(0,2,69),(2,1,74),(3,2,72),(5,1,69)],
    [(0,3,67),(3,2,64),(5,1,65)],
    [(0,2,67),(2,1,69),(3,2,72),(5,1,74)],
    [(0,6,76)],
    [(0,2,77),(2,1,76),(3,2,74),(5,1,72)],
    [(0,3,69),(3,2,67),(5,1,69)],
    [(0,2,65),(2,1,64),(3,2,62),(5,1,64)],
    [(0,6,62)],
]
THEME_A_CH = ['Dm','C','F','Am','Dm','F','C','Dm']
THEME_B = [
    [(0,2,74),(2,1,76),(3,2,77),(5,1,79)],
    [(0,3,81),(3,2,79),(5,1,77)],
    [(0,2,76),(2,1,77),(3,2,79),(5,1,76)],
    [(0,6,81)],
    [(0,2,74),(2,1,72),(3,2,69),(5,1,67)],
    [(0,3,65),(3,2,67),(5,1,69)],
    [(0,2,72),(2,1,69),(3,2,67),(5,1,64)],
    [(0,6,62)],
]
THEME_B_CH = ['Bb','F','C','A','Dm','Bb','C','Dm']

def theme_line(bars, start_bar, shift=0, minor=False, sharpen=None):
    out = []
    for i, bar in enumerate(bars):
        for st, d, p in bar:
            q = p + shift
            if minor and q % 12 == 11: q -= 1  # dorian B -> aeolian Bb (D minor)
            if sharpen is not None and q % 12 == sharpen: q += 1
            out.append(((start_bar + i) * 6 + st, d, q))
    return out

def put_line(s, tr, line, vel=82, legato=0.95):
    for st, d, p in line: s.line(tr, 0, [(st, d, p)], vel=vel, legato=legato)

# ---------------------------------------------------------------------------- Planeswalk
def pw_title():
    s = Song(87, beats=6, unit=8, seed=11)
    harp = s.ch('harp', 46, 0, vol=96, pan=50, rev=70)
    pad = s.ch('pad', 49, 1, vol=78, rev=90)
    fl = s.ch('flute', 73, 2, vol=104, pan=74, rev=80)
    horn = s.ch('horn', 60, 3, vol=92, pan=60, rev=85)
    cello = s.ch('cello', 42, 4, vol=86, pan=40, rev=70)
    bell = s.ch('bell', 9, 5, vol=58, pan=90, rev=100)
    prog = THEME_A_CH * 2 + THEME_B_CH + THEME_A_CH
    P = ['Dm','Dm'] + prog  # 2-bar intro
    total = len(P)
    s.arp(harp, P, (0, total), [0, 1, 2, 3, 2, 1], low=50, vel=58)
    s.pad(pad, P, (2, total), low=50, vel=48)
    s.bass(cello, P, (0, total), pattern=((0, 3, 0), (3, 3, 7)), octave=38, vel=64)
    put_line(s, fl, theme_line(THEME_A, 2), vel=80)
    put_line(s, horn, theme_line(THEME_A, 10, shift=-12), vel=74)
    s.arp(fl, P, (10, 18), [None, None, None, 4, None, 5], low=72, vel=44)
    put_line(s, fl, theme_line(THEME_B, 18), vel=86)
    put_line(s, fl, theme_line(THEME_A, 26), vel=78)
    put_line(s, horn, theme_line(THEME_A, 26, shift=-12), vel=60)
    for b in (2, 10, 18, 26): s.line(bell, b, [(0, 6, 86)], vel=60)
    return s, total, True

def pw_map_innistrad():
    # Gothic: organ and choir in D minor, a music-box quote of the theme, tolling bells, slow 3/4.
    s = Song(66, beats=3, seed=21)
    org = s.ch('organ', 19, 0, vol=70, rev=100)
    choir = s.ch('choir', 52, 1, vol=78, pan=50, rev=110)
    box = s.ch('box', 10, 2, vol=88, pan=78, rev=90)
    cello = s.ch('cello', 42, 3, vol=88, pan=40, rev=80)
    bell = s.ch('bell', 14, 4, vol=72, pan=84, rev=110)
    vio = s.ch('violin', 40, 5, vol=86, pan=70, rev=90)
    TM = ['Dm','C','F','Am','Dm','F','C','Dm']
    P = ['Dm','Dm','Bb','A'] + TM + ['Bb','Gm','A','Dm','Bb','Gm','Eb','A'] + TM + ['Bb','Gm','A','A']
    total = 32
    s.pad(org, P, (0, total), low=48, vel=52, n=3)
    s.pad(choir, P, (8, total), low=55, vel=46, n=3)
    s.bass(cello, P, (0, total), pattern=((0, 2, 0), (2, 1, 7)), octave=36, vel=62)
    # The theme, slowed into 3/4 on music box, in D minor.
    th = theme_line(THEME_A, 0, minor=True)
    def to34(line, bar0):
        return [((bar0 * 3) + st / 2, d / 2 * 1.0, p) for st, d, p in line]
    for st, d, p in to34(th, 4): s.line(box, 0, [(st, d, p + 12)], vel=70)
    s.melody(vio, P, (12, 20), 2, 'harm', [[(0, 1.5), (1.5, 0.5), (2, 1)], [(0, 1), (1, 1), (2, 1)]], low=67, high=81, vel=70, phrase=4, cadence=3, seed=4)
    for st, d, p in to34(th, 20): s.line(box, 0, [(st, d, p + 12)], vel=62)
    s.melody(vio, P, (28, 32), 2, 'harm', [[(0, 1), (1, 1), (2, 1)]], low=67, high=79, vel=64, phrase=4, cadence=3, seed=6)
    for b in range(0, total, 4): s.line(bell, b, [(0, 3, 50 + (chord(P[b])[0] - 2) % 12)], vel=76)
    return s, total, True

def pw_map_zendikar():
    # Wild and open: hand drums, kalimba, open fifths on strings, pan flute; E dorian.
    s = Song(96, beats=4, seed=31)
    strings = s.ch('strings', 48, 0, vol=72, rev=80)
    kal = s.ch('kalimba', 108, 1, vol=84, pan=40, rev=60)
    flute = s.ch('panflute', 75, 2, vol=100, pan=80, rev=80)
    bass = s.ch('bass', 32, 3, vol=88, rev=30)
    oc = s.ch('ocarina', 79, 4, vol=86, pan=60, rev=90)
    drums = s.ch('drums', 0, 9, vol=96, rev=40)
    P = ['Em5','D5','C5','D5','Em5','G5','A5','B5']
    P = ['E5','D5','C5','D5','E5','G5','A5','B5']
    PM = ['Em','D','C','D','Em','G','A','Bm']
    total = 32
    s.pad(strings, P, (0, total), low=45, vel=50, n=3)
    s.arp(kal, PM, (0, total), [0, 2, 1, 3, 0, 2, 4, 2], low=62, vel=56)
    s.bass(bass, PM, (0, total), pattern=((0, 1.5, 0), (1.5, 0.5, 7), (2.5, 1, 12), (3.5, 0.5, 7)), octave=36, vel=70)
    groove = [(0, 64, 82), (3, 63, 60), (6, 62, 64), (8, 64, 78), (10, 63, 62), (11, 60, 54), (14, 61, 60), (15, 70, 40), (4, 70, 36), (12, 70, 36)]
    s.hits(drums, (2, total), groove)
    s.hits(drums, (0, total), [(0, 41, 70)], every=4)
    rh = [[(0, 1.5), (1.5, 0.5), (2, 1), (3, 1)], [(0, 0.5), (0.5, 0.5), (1, 1), (2, 2)]]
    s.melody(flute, PM, (8, 24), 4, 'dorian', rh, low=69, high=86, vel=82, cadence=4, seed=7)
    th = theme_line(THEME_A, 0, shift=2)
    for st, d, p in th: s.line(oc, 24, [(st / 1.5, d / 1.5, p)], vel=74)
    return s, total, True

def pw_map_ravnica():
    # The city: clockwork wood blocks and pizzicato, French horns and clarinet; C minor, 104.
    s = Song(104, beats=4, seed=41)
    horns = s.ch('horns', 60, 0, vol=82, pan=50, rev=80)
    pizz = s.ch('pizz', 45, 1, vol=90, pan=74, rev=60)
    clar = s.ch('clarinet', 71, 2, vol=96, pan=60, rev=80)
    bass = s.ch('bass', 43, 3, vol=84, rev=60)
    cel = s.ch('celesta', 8, 4, vol=70, pan=90, rev=90)
    tuba = s.ch('tuba', 58, 5, vol=70, rev=60)
    drums = s.ch('drums', 0, 9, vol=88, rev=40)
    P = ['Cm','Cm','Ab','Ab','Fm','G','Cm','G','Eb','Bb','Ab','G','Fm','Ab','G','G']
    total = 32
    s.pad(horns, P, (4, total), low=50, vel=50, n=3, every=1)
    s.arp(pizz, P, (0, total), [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 3, 2, 1, 0], low=58, vel=58, dur=0.8)
    s.bass(bass, P, (0, total), pattern=((0, 1, 0), (2, 1, 7)), octave=36, vel=70)
    s.bass(tuba, P, (8, total), pattern=((0, 0.5, 0),), octave=36, vel=62)
    tick = [(i, 76 if i % 4 == 0 else 77, 58 if i % 4 == 0 else 44) for i in range(0, 16, 2)]
    s.hits(drums, (0, total), tick)
    s.hits(drums, (8, total), [(0, 36, 70), (8, 36, 60)])
    rh = [[(0, 1), (1, 0.5), (1.5, 0.5), (2, 1.5), (3.5, 0.5)], [(0, 0.5), (0.5, 0.5), (1, 0.5), (1.5, 0.5), (2, 2)]]
    s.melody(clar, P, (8, 32), 0, 'harm', rh, low=63, high=80, vel=80, cadence=4, seed=9)
    s.arp(cel, P, (16, 32), [None, 4, None, 5, None, 4, None, 6], low=74, vel=46)
    return s, total, True

ACT = {
    1: dict(key='Dm', mode='harm', lead=40, lead2=6, color=52, drums='orch', tempo=132),     # Innistrad: violin, harpsichord, choir
    2: dict(key='Em', mode='dorian', lead=73, lead2=108, color=116, drums='taiko', tempo=128), # Zendikar: flute, kalimba, taiko
    3: dict(key='Cm', mode='harm', lead=56, lead2=45, color=61, drums='snare', tempo=136),     # Ravnica: trumpet, pizz, brass
}
def transpose_prog(prog, root):
    names = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
    out = []
    for c in prog:
        r, _, _, _ = chord(c); i = 1 + (1 if len(c) > 1 and c[1] in '#b' else 0)
        out.append(names[(r + root) % 12] + c[i:])
    return out

def battle(act, kind='battle'):
    a = ACT[act]
    root = {'Dm': 2, 'Em': 4, 'Cm': 0}[a['key']]
    base = {'battle': ['Am','Am','F','G','Am','F','E','E','Am','C','G','F','Dm','F','E','E'],
            'elite':  ['Am','Bb','Am','E','Am','Bb','Dm','E','F','Dm','Bb','E','Am','Bb','E','E'],
            'boss':   ['Am','Am','F','F','Dm','Dm','E','E','Am','C','Dm','Bb','F','Dm','E','E']}[kind]
    P = transpose_prog(base, (root - 9) % 12)
    tempo = a['tempo'] + {'battle': 0, 'elite': -8, 'boss': 12}[kind]
    s = Song(tempo, beats=4, seed=act * 100 + len(kind))
    strings = s.ch('strings', 48, 0, vol=84, rev=60)
    low = s.ch('low', 42, 1, vol=92, pan=44, rev=40)
    brass = s.ch('brass', 61, 2, vol=80, pan=60, rev=70)
    lead = s.ch('lead', a['lead'], 3, vol=96, pan=72, rev=70)
    second = s.ch('second', a['lead2'], 4, vol=74, pan=88, rev=60)
    timp = s.ch('timp', 47, 5, vol=96, rev=70)
    color = s.ch('color', a['color'], 6, vol=76, pan=34, rev=90)
    drums = s.ch('drums', 0, 9, vol=100, rev=40)
    total = 32
    # Driving low ostinato: 8ths with accents.
    s.arp(low, P, (0, total), [0, 0, 1, 0, 0, 0, 2, 0], low=38, vel=72, dur=0.9)
    s.pad(strings, P, (4, total), low=50, vel=56, n=3)
    s.stabs(brass, P, (8, total), [0, 6, 10] if kind != 'boss' else [0, 3, 6, 10, 12], low=52, vel=84)
    s.bass(timp, P, (0, total), pattern=((0, 0.5, 0), (2.5, 0.5, 0), (3, 0.5, 7)), octave=40, vel=88)
    if a['drums'] == 'taiko':
        s.hits(drums, (0, total), [(0, 41, 100), (4, 45, 70), (6, 41, 84), (10, 43, 80), (12, 41, 96), (14, 45, 70)])
        s.bass(color, P, (0, total), pattern=((0, 0.5, 0), (1.5, 0.5, 0), (3, 0.5, 0)), octave=36, vel=96)
    elif a['drums'] == 'snare':
        s.hits(drums, (0, total), [(0, 36, 96), (4, 38, 84), (8, 36, 90), (10, 36, 70), (12, 38, 86), (14, 38, 60), (15, 38, 64)] + [(i, 42, 46) for i in range(0, 16, 2)])
        s.hits(drums, (0, total), [(i, 76, 50) for i in range(1, 16, 2)])
        s.pad(color, P, (16, total), low=55, vel=60, n=3)
    else:
        s.hits(drums, (0, total), [(0, 36, 96), (6, 45, 70), (8, 36, 84), (12, 38, 74), (14, 45, 64)])
        s.pad(color, P, (8, total), low=55, vel=58, n=3)  # choir
    if kind == 'boss': s.hits(drums, (0, total), [(0, 49, 88)], every=4)
    rh = {'battle': [[(0, 1), (1, 0.5), (1.5, 0.5), (2, 1), (3, 1)], [(0, 0.5), (0.5, 0.5), (1, 1.5), (2.5, 0.5), (3, 1)]],
          'elite': [[(0, 1.5), (1.5, 0.5), (2, 2)], [(0, 0.5), (0.5, 0.5), (1, 0.5), (1.5, 0.5), (2, 1), (3, 1)]],
          'boss': [[(0, 0.5), (0.5, 0.5), (1, 0.5), (1.5, 0.5), (2, 1), (3, 1)], [(0, 1.5), (1.5, 0.5), (2, 1.5), (3.5, 0.5)]]}[kind]
    s.melody(lead, P, (8, 24), root, a['mode'], rh, low=67, high=86, vel=90, cadence=4, seed=act * 7 + len(kind))
    s.melody(lead, P, (24, 32), root, a['mode'], rh[::-1], low=72, high=89, vel=94, cadence=4, seed=act * 13 + len(kind))
    s.arp(second, P, (16, total), [0, 1, 2, 3, 2, 1, 2, 3] if act != 3 else [0, None, 2, None, 1, None, 3, None], low=64, vel=58, dur=0.9)
    return s, total, True

def pw_shop():
    # Night market: accordion, pizzicato and tambourine in a jaunty A minor 6/8.
    s = Song(116, beats=6, unit=8, seed=51)
    acc = s.ch('accordion', 21, 0, vol=86, pan=60, rev=60)
    pizz = s.ch('pizz', 45, 1, vol=90, pan=40, rev=50)
    bass = s.ch('bass', 32, 2, vol=88, rev=30)
    clar = s.ch('clarinet', 71, 3, vol=88, pan=80, rev=70)
    drums = s.ch('drums', 0, 9, vol=80, rev=40)
    P = ['Am','Am','Dm','E','Am','F','E','E','C','G','Am','E','F','Dm','E','Am']
    total = 32
    s.bass(bass, P, (0, total), pattern=((0, 1, 0), (3, 1, 7)), octave=36, vel=76)
    s.stabs(acc, P, (0, total), [5, 13], low=57, vel=58, n=3, dur=0.8)
    s.arp(pizz, P, (4, total), [0, 2, 1, 2, 3, 2], low=57, vel=56, dur=0.8)
    s.hits(drums, (2, total), [(0, 54, 54), (5, 54, 40), (8, 54, 56), (13, 54, 40), (0, 64, 66), (8, 63, 52)])
    s.melody(acc, P, (8, 24), 9, 'harm', [[(0, 2), (2, 1), (3, 1), (4, 1), (5, 1)], [(0, 1), (1, 1), (2, 1), (3, 3)]], low=69, high=84, vel=80, cadence=6, seed=3)
    s.melody(clar, P, (24, 32), 9, 'harm', [[(0, 1), (1, 1), (2, 1), (3, 2), (5, 1)]], low=64, high=79, vel=76, cadence=6, seed=8)
    return s, total, True

def pw_rest():
    # Bonfire: nylon guitar, cello and a low flute; warm G major, unhurried.
    s = Song(72, beats=4, seed=61)
    gtr = s.ch('guitar', 24, 0, vol=96, pan=50, rev=60)
    cello = s.ch('cello', 42, 1, vol=84, pan=40, rev=70)
    fl = s.ch('flute', 73, 2, vol=88, pan=74, rev=90)
    pad = s.ch('pad', 89, 3, vol=56, rev=100)
    TM = ['Dm','C','F','Am','Dm','F','C','Dm']
    P = ['F','C','Dm','Bb','F','C','Bb','C'] + TM + ['Bb','F','C','F','Dm','Bb','C','C'] + TM
    total = 32
    s.arp(gtr, P, (0, total), [0, 2, 1, 3, 2, 1, 3, 2], low=50, vel=58, dur=2.0)
    s.bass(cello, P, (4, total), pattern=((0, 4, 0),), octave=38, vel=56)
    s.pad(pad, P, (0, total), low=55, vel=40, n=3)
    th = theme_line(THEME_A, 0)  # the wandering theme, at rest by the fire
    for st, d, p in th: s.line(fl, 8, [(st * 2 / 3, d * 2 / 3 * 1.5, p)], vel=64)
    for st, d, p in th: s.line(cello, 24, [(st * 2 / 3, d * 2 / 3 * 1.5, p - 24)], vel=58)
    s.melody(fl, P, (16, 24), 5, 'major', [[(0, 2), (2, 1), (3, 1)], [(0, 1), (1, 1), (2, 2)]], low=67, high=81, vel=60, cadence=4, seed=5)
    return s, total, True

def pw_event():
    # Treasure and strange shrines: celesta, harp and tremolo strings in F lydian.
    s = Song(80, beats=4, seed=71)
    cel = s.ch('celesta', 8, 0, vol=86, pan=70, rev=100)
    harp = s.ch('harp', 46, 1, vol=84, pan=40, rev=90)
    trem = s.ch('trem', 44, 2, vol=66, rev=100)
    bass = s.ch('bass', 43, 3, vol=72, rev=80)
    vib = s.ch('vibes', 11, 4, vol=70, pan=86, rev=110)
    P = ['F','G','F','G','Dm','G','Am','C','F','G','Em','Am','Dm','G','C','C']
    total = 32
    s.pad(trem, P, (0, total), low=55, vel=42, n=3)
    s.arp(harp, P, (0, total), [0, 1, 2, 3, 4, 3, 2, 1], low=53, vel=52)
    s.bass(bass, P, (0, total), pattern=((0, 4, 0),), octave=36, vel=58)
    s.melody(cel, P, (4, 28), 5, 'lydian', [[(0, 1.5), (1.5, 0.5), (2, 2)], [(0, 0.5), (0.5, 0.5), (1, 1), (2, 1), (3, 1)]], low=72, high=91, vel=70, cadence=4, seed=12)
    s.arp(vib, P, (12, 28), [None, 4, None, None, 5, None, None, 6], low=72, vel=48)
    return s, total, True

def pw_blind_eternities():
    # Ugin's blessing in the Blind Eternities: no pulse, cold glass and air over a deep drone; whole-tone shimmer.
    s = Song(50, beats=4, seed=81)
    halo = s.ch('halo', 94, 0, vol=80, rev=127, cho=80)
    air = s.ch('air', 99, 1, vol=64, pan=30, rev=127)
    choir = s.ch('choir', 91, 2, vol=64, pan=90, rev=127)
    glass = s.ch('glass', 9, 3, vol=66, pan=80, rev=127)
    cel = s.ch('celesta', 8, 4, vol=60, pan=40, rev=127)
    drone = s.ch('drone', 43, 5, vol=70, rev=100)
    P = ['Cadd9','D/C','Cadd9','Bb/C','Cadd9','D/C','Ab/C','Bb/C']
    total = 16
    s.pad(halo, P, (0, total), low=52, vel=60, n=4, hold=1.0, every=2)
    s.pad(choir, P, (2, total), low=60, vel=46, n=3, every=2)
    s.swell(drone, [(0, 8), (8, 16)], [36, 48], vel=70)
    s.swell(air, [(0, 16)], [72, 84], vel=40)
    import random
    r = random.Random(5 + engine.VAR)
    for b in range(total):
        _, pcs, _, _ = chord(P[b % len(P)])
        tones = [p for p in range(74, 94) if p % 12 in pcs]
        for k in range(r.choice((1, 2, 2, 3))):
            s.line(glass if k % 2 == 0 else cel, b, [(r.choice((0, 0.5, 1, 1.5, 2, 2.5, 3)), 3, r.choice(tones))], vel=r.randint(34, 58))
    return s, total, True

def stinger_win(key=2, brass=61):
    s = Song(100, beats=4, seed=91)
    b = s.ch('brass', brass, 0, vol=104, rev=90); st = s.ch('strings', 48, 1, vol=90, rev=90)
    t = s.ch('timp', 47, 2, vol=100, rev=80); tr = s.ch('trumpet', 56, 3, vol=100, pan=70, rev=90)
    d = s.ch('drums', 0, 9, vol=96, rev=60); hp = s.ch('harp', 46, 4, vol=86, pan=40, rev=90)
    k = key
    s.line(tr, 0, [(0, .5, 62 + k), (.5, .5, 66 + k), (1, .5, 69 + k), (1.5, 2.5, 74 + k), (4, .75, 71 + k), (4.75, .25, 74 + k), (5, 3, 79 + k), (8, 4, 78 + k)], vel=100)
    for c, b0, b1 in (('D', 0, 1), ('G', 1, 2), ('D', 2, 3)):
        s.pad(b, [c], (b0, b1), low=50 + k, vel=86, n=4)
        s.pad(st, [c], (b0, b1), low=55 + k, vel=70, n=4)
    s.bass(t, ['D'], (0, 3), pattern=((0, .5, 0), (3, .25, 0), (3.5, .25, 0)), octave=38 + k, vel=100)
    s.hits(d, (2, 3), [(0, 49, 100), (0, 36, 100)])
    s.arp(hp, ['D'], (0, 1), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], low=50 + k, vel=62)
    return s, 3, False

def stinger_lose(key=2):
    s = Song(60, beats=4, seed=92)
    st = s.ch('strings', 49, 0, vol=96, rev=110); ch = s.ch('choir', 52, 1, vol=80, rev=120)
    vc = s.ch('cello', 42, 2, vol=92, rev=100); t = s.ch('timp', 47, 3, vol=90, rev=100); bell = s.ch('bell', 14, 4, vol=70, rev=120)
    k = key
    s.line(vc, 0, [(0, 1.5, 62 + k), (1.5, .5, 60 + k), (2, 2, 57 + k), (4, 1.5, 58 + k), (5.5, .5, 57 + k), (6, 2, 55 + k), (8, 4, 50 + k)], vel=84)
    for c, b0 in (('Dm', 0), ('Bb', 1), ('A', 1.5), ('Dm', 2)):
        pass
    s.pad(st, ['Dm','Gm/D','Dm'], (0, 3), low=50 + k, vel=62, n=4)
    s.pad(ch, ['Dm','Gm/D','Dm'], (1, 3), low=55 + k, vel=50, n=3)
    s.line(t, 0, [(0, 1, 38 + k), (8, 2, 38 + k)], vel=90)
    s.line(bell, 2, [(0, 4, 50 + k)], vel=70)
    return s, 3, False

# ---------------------------------------------------------------------------- match table
def tbl_early():
    # Guild hall: lute-like guitar, hammered dulcimer, bodhran and a tin whistle; D mixolydian 6/8.
    s = Song(105, beats=6, unit=8, seed=101)
    lute = s.ch('lute', 24, 0, vol=94, pan=44, rev=60)
    dulc = s.ch('dulcimer', 15, 1, vol=78, pan=80, rev=70)
    whistle = s.ch('whistle', 72, 2, vol=82, pan=64, rev=80)
    bass = s.ch('bass', 32, 3, vol=84, rev=30)
    strings = s.ch('strings', 48, 4, vol=62, rev=80)
    drums = s.ch('drums', 0, 9, vol=84, rev=30)
    P = ['D','C','G','D','D','C','Em','A','G','D','C','D','G','Em','A','D']
    total = 32
    s.arp(lute, P, (0, total), [0, 1, 2, 3, 2, 1], low=52, vel=60)
    s.bass(bass, P, (0, total), pattern=((0, 2, 0), (3, 2, 7)), octave=36, vel=70)
    s.pad(strings, P, (8, total), low=55, vel=42, n=3)
    s.hits(drums, (4, total), [(0, 45, 70), (5, 47, 46), (8, 45, 60), (11, 47, 42), (13, 47, 50)])
    s.melody(whistle, P, (8, 24), 2, 'mixo', [[(0, 2), (2, 1), (3, 2), (5, 1)], [(0, 1), (1, 1), (2, 1), (3, 3)]], low=74, high=91, vel=74, cadence=6, seed=21)
    s.arp(dulc, P, (16, 32), [4, None, 3, 4, None, 5], low=67, vel=50)
    return s, total, True

def tbl_combat():
    s, total, loop = battle(1, 'battle')
    return s, total, loop

def tbl_lowlife():
    # Someone is close to losing: tremolo strings, heartbeat timpani, a rising cello line; D harmonic minor.
    s = Song(112, beats=4, seed=111)
    trem = s.ch('trem', 44, 0, vol=86, rev=80)
    vc = s.ch('cello', 42, 1, vol=92, pan=40, rev=70)
    t = s.ch('timp', 47, 2, vol=100, rev=70)
    brass = s.ch('brass', 61, 3, vol=76, pan=60, rev=80)
    vio = s.ch('violin', 40, 4, vol=88, pan=74, rev=80)
    drums = s.ch('drums', 0, 9, vol=90, rev=40)
    P = ['Dm','Dm','Bb','A','Dm','Gm','Eb','A','Dm','Dm','Bb','A','Gm','Bb','A','A']
    total = 32
    s.pad(trem, P, (0, total), low=55, vel=60, n=4)
    s.bass(t, P, (0, total), pattern=((0, .25, 0), (.5, .25, 0), (2, .25, 0), (2.5, .25, 0)), octave=38, vel=92)
    s.arp(vc, P, (0, total), [0, 0, 1, 0, 2, 0, 1, 0], low=38, vel=70, dur=0.9)
    s.stabs(brass, P, (8, total), [0, 12], low=52, vel=78)
    s.melody(vio, P, (8, 32), 2, 'harm', [[(0, 1.5), (1.5, .5), (2, 2)], [(0, .5), (.5, .5), (1, 1), (2, 2)]], low=69, high=88, vel=86, cadence=4, seed=33)
    s.hits(drums, (16, total), [(0, 36, 86), (8, 36, 80), (12, 38, 60)])
    return s, total, True

CUES = {
    'MUS-PW-01': pw_title, 'MUS-PW-02': pw_map_innistrad, 'MUS-PW-03': pw_map_zendikar, 'MUS-PW-04': pw_map_ravnica,
    'MUS-PW-05': lambda: battle(1), 'MUS-PW-05-2': lambda: battle(2), 'MUS-PW-05-3': lambda: battle(3),
    'MUS-PW-06': lambda: battle(1, 'elite'), 'MUS-PW-06-2': lambda: battle(2, 'elite'), 'MUS-PW-06-3': lambda: battle(3, 'elite'),
    'MUS-PW-10': lambda: battle(1, 'boss'), 'MUS-PW-10-2': lambda: battle(2, 'boss'), 'MUS-PW-10-3': lambda: battle(3, 'boss'),
    'MUS-PW-07': pw_shop, 'MUS-PW-08': pw_rest, 'MUS-PW-09': pw_event, 'MUS-PW-13': pw_blind_eternities,
    'MUS-PW-11': lambda: stinger_win(0), 'MUS-PW-12': lambda: stinger_lose(0),
    'MUS-TBL-03': tbl_early, 'MUS-TBL-04': lambda: tbl_combat_alt(), 'MUS-TBL-05': tbl_lowlife,
    'MUS-TBL-06': lambda: stinger_win(0, 60), 'MUS-TBL-07': lambda: stinger_lose(0),
}

def tbl_combat_alt():
    # Table combat: the guild-hall palette with drums and brass, G minor, distinct from Planeswalk battles.
    s = Song(126, beats=4, seed=121)
    low = s.ch('low', 42, 0, vol=90, rev=40); st = s.ch('strings', 48, 1, vol=80, rev=60)
    br = s.ch('brass', 61, 2, vol=82, pan=60, rev=70); lead = s.ch('lead', 60, 3, vol=94, pan=70, rev=70)
    dulc = s.ch('dulcimer', 15, 4, vol=70, pan=86, rev=60); t = s.ch('timp', 47, 5, vol=92, rev=70)
    d = s.ch('drums', 0, 9, vol=96, rev=40)
    P = ['Gm','Gm','Eb','F','Gm','Eb','D','D','Cm','Gm','Eb','D','Cm','Eb','D','D']
    total = 32
    s.arp(low, P, (0, total), [0, 0, 1, 0, 0, 2, 0, 1], low=38, vel=72, dur=.9)
    s.pad(st, P, (4, total), low=50, vel=54, n=3)
    s.stabs(br, P, (8, total), [0, 6, 12], low=52, vel=82)
    s.bass(t, P, (0, total), pattern=((0, .5, 0), (3, .5, 7)), octave=38, vel=90)
    s.hits(d, (0, total), [(0, 45, 92), (4, 47, 60), (6, 45, 80), (8, 45, 88), (12, 43, 76), (14, 47, 60)])
    s.melody(lead, P, (8, 32), 7, 'harm', [[(0, 1), (1, .5), (1.5, .5), (2, 2)], [(0, .5), (.5, .5), (1, 1), (2, 1), (3, 1)]], low=65, high=82, vel=88, cadence=4, seed=44)
    s.arp(dulc, P, (16, total), [0, 1, 2, 3, 2, 1, 2, 3], low=67, vel=50, dur=.9)
    return s, total, True

# The blessing patrons' themes (MUS-PWG-01..12) live in patrons.py.
from patrons import PATRONS
CUES.update(PATRONS)
