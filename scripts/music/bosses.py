# A theme for every Planeswalk boss (MUS-BOSS-*). Each boss has a hand-written eight-bar motif and a palette of
# its own. Form: four bars of bed, then the motif on its main voice, then on its second voice under a
# counterline, then both together. The loop's second pass swaps the two voices.
import engine
from engine import Song
from patrons import mot

def form(s, P, M, A, B, T, counter=None):
    (la, sa), (lb, sb) = (B, A) if engine.VAR == 1 else (A, B)
    mot(s, la, 8, M, shift=sa, vel=90)
    mot(s, lb, 16, M, shift=sb, vel=86)
    if counter: counter(la, 16, 24)
    mot(s, la, 24, M, shift=sa, vel=94)
    mot(s, lb, 24, M, shift=sb, vel=84)

def sorin():
    # Sorin, Vengeful Bloodlord: D minor gothic toccata. Organ runs, harpsichord, choir, trombones.
    s = Song(138, seed=301)
    organ = s.ch('organ', 19, 0, vol=78, rev=90)
    hpsd = s.ch('harpsichord', 6, 1, vol=70, pan=36, rev=70)
    vio = s.ch('violins', 48, 2, vol=92, pan=66, rev=70)
    tbn = s.ch('trombone', 57, 3, vol=90, pan=56, rev=70)
    choir = s.ch('choir', 52, 4, vol=72, rev=100)
    timp = s.ch('timp', 47, 5, vol=92, rev=70)
    drums = s.ch('drums', 0, 9, vol=92, rev=50)
    P = ['Dm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'A', 'A']
    M = [[(0, .5, 74), (.5, .5, 73), (1, 1, 74), (2, .5, 69), (2.5, .5, 65), (3, 1, 62)], [(0, 1, 69), (1, 1, 74), (2, 1, 77), (3, 1, 81)],
         [(0, 2, 82), (2, 1, 77), (3, 1, 74)], [(0, 3, 76), (3, 1, 73)], [(0, 1, 74), (1, 1, 70), (2, 1, 67), (3, 1, 70)],
         [(0, 2, 69), (2, 1, 74), (3, 1, 77)], [(0, 1, 76), (1, 1, 73), (2, 1, 69), (3, 1, 64)], [(0, 4, 69)]]
    T = 32
    s.arp(organ, P, (0, T), [0, 1, 2, 1] * 4, low=50, vel=52, dur=.9)
    s.arp(hpsd, P, (8, T), [0, 2, 1, 2, 0, 2, 1, 2], low=62, vel=48, dur=.9)
    s.pad(choir, P, (4, T), low=52, vel=50, n=3)
    s.bass(timp, P, (0, T), pattern=((0, .5, 0), (2, .5, 0), (3.5, .5, 7)), octave=38, vel=86)
    s.hits(drums, (0, T), [(0, 36, 92), (8, 36, 84), (4, 38, 70), (12, 38, 80)])
    s.hits(drums, (0, T), [(0, 49, 86)], every=8)
    form(s, P, M, (vio, 0), (tbn, -12), T,
         lambda tr, a, b: s.melody(tr, P, (a, b), 2, 'harm', [[(0, .5), (.5, .5), (1, 1), (2, 2)], [(0, 1), (1, 1), (2, 1), (3, 1)]], low=72, high=88, vel=70, cadence=4, seed=11))
    return s, T, True

def olivia():
    # Olivia, Bride of Night: a G minor danse macabre waltz. Strings, harpsichord, solo violin, bells.
    s = Song(150, beats=3, seed=302)
    strings = s.ch('strings', 48, 0, vol=80, rev=80)
    low = s.ch('low', 42, 1, vol=88, rev=60)
    vio = s.ch('violin', 40, 2, vol=96, pan=66, rev=90)
    hpsd = s.ch('harpsichord', 6, 3, vol=72, pan=36, rev=80)
    choir = s.ch('choir', 53, 4, vol=66, rev=110)
    bell = s.ch('bell', 14, 5, vol=56, pan=86, rev=110)
    timp = s.ch('timp', 47, 6, vol=80, rev=80)
    P = ['Gm', 'Gm', 'Cm', 'D', 'Eb', 'Cm', 'D7', 'Gm']
    M = [[(0, 2, 74), (2, 1, 70)], [(0, 1, 67), (1, 1, 70), (2, 1, 74)], [(0, 2, 75), (2, 1, 72)], [(0, 2, 69), (2, 1, 66)],
         [(0, 2, 79), (2, 1, 75)], [(0, 1, 72), (1, 1, 75), (2, 1, 79)], [(0, 2, 78), (2, 1, 72)], [(0, 3, 74)]]
    T = 32
    s.bass(low, P, (0, T), pattern=((0, 1, 0),), octave=38, vel=72)
    s.arp(strings, P, (0, T), [None, 1, 1], low=55, vel=52, dur=.8)
    s.arp(strings, P, (0, T), [None, 2, 2], low=55, vel=48, dur=.8)
    s.arp(hpsd, P, (8, T), [0, 1, 2, 3, 2, 1], low=67, vel=44, dur=.9)
    s.pad(choir, P, (16, T), low=55, vel=42, n=3)
    s.bass(timp, P, (0, T), pattern=((0, .5, 0),), octave=38, vel=60)
    for b in range(0, T, 8): s.line(bell, b, [(0, 3, 79)], vel=44)
    form(s, P, M, (vio, 0), (choir, -12), T,
         lambda tr, a, b: s.melody(tr, P, (a, b), 7, 'harm', [[(0, 1), (1, 1), (2, 1)], [(0, 2), (2, 1)]], low=79, high=91, vel=62, cadence=3, seed=12))
    return s, T, True

def ob():
    # Ob Nixilis Reignited: C phrygian, brutal. Low strings hammering, war drums, trombones and a low choir.
    s = Song(128, seed=303)
    low = s.ch('low', 42, 0, vol=94, rev=40)
    bass = s.ch('bass', 43, 1, vol=86, rev=40)
    brass = s.ch('brass', 61, 2, vol=90, pan=60, rev=70)
    tbn = s.ch('trombone', 57, 3, vol=92, pan=44, rev=70)
    choir = s.ch('choir', 52, 4, vol=76, rev=100)
    taiko = s.ch('taiko', 116, 5, vol=90, rev=80)
    drums = s.ch('drums', 0, 9, vol=96, rev=50)
    P = ['C5', 'Db', 'C5', 'Bb', 'C5', 'Db', 'Ab', 'G']
    M = [[(0, 1.5, 60), (1.5, .5, 61), (2, 2, 60)], [(0, 1, 61), (1, 1, 65), (2, 2, 68)], [(0, 2, 67), (2, .5, 66), (2.5, 1.5, 60)], [(0, 4, 58)],
         [(0, 1, 60), (1, 1, 63), (2, 1, 67), (3, 1, 70)], [(0, 2, 68), (2, 2, 65)], [(0, 2, 63), (2, 2, 60)], [(0, 2, 59), (2, 2, 62)]]
    T = 32
    s.arp(low, P, (0, T), [0, 0, 0, 1, 0, 0, 1, 0], low=36, vel=78, dur=.8)
    s.bass(bass, P, (0, T), pattern=((0, 2, 0), (2, 2, 0)), octave=28, vel=70)
    s.pad(choir, P, (8, T), low=48, vel=52, n=3)
    s.stabs(brass, P, (16, T), [0, 3, 6], low=55, vel=74)
    for b in range(T): s.line(taiko, b, [(0, .5, 38), (1.5, .5, 38), (3, .5, 43)], vel=82 if b % 2 == 0 else 70)
    s.hits(drums, (4, T), [(0, 36, 96), (6, 36, 80), (8, 38, 88), (14, 38, 70)])
    s.hits(drums, (0, T), [(0, 49, 90)], every=8)
    form(s, P, M, (tbn, 0), (brass, 12), T,
         lambda tr, a, b: s.melody(choir, P, (a, b), 0, 'phryg', [[(0, 2), (2, 2)], [(0, 4)]], low=60, high=72, vel=56, cadence=4, seed=13))
    return s, T, True

def herald():
    # Kozilek's Herald: whole-tone and 7/8. No semitone anywhere, nothing to stand on. Glass, tremolo, toms.
    s = Song(140, beats=7, unit=8, seed=304)
    halo = s.ch('halo', 94, 0, vol=72, rev=127, cho=60)
    trem = s.ch('trem', 44, 1, vol=76, rev=110)
    bass = s.ch('bass', 43, 2, vol=84, rev=60)
    horn = s.ch('horn', 60, 3, vol=94, pan=60, rev=90)
    choir = s.ch('choir', 91, 4, vol=70, pan=40, rev=127)
    glass = s.ch('glass', 9, 5, vol=56, pan=86, rev=127)
    drums = s.ch('drums', 0, 9, vol=92, rev=60)
    P = ['Caug', 'Daug', 'Caug', 'Daug', 'Caug', 'Daug', 'Caug', 'Daug']
    M = [[(0, 2, 72), (2, 2, 76), (4, 3, 80)], [(0, 4, 78), (4, 3, 74)], [(0, 2, 76), (2, 2, 72), (4, 3, 68)], [(0, 7, 70)],
         [(0, 2, 80), (2, 2, 78), (4, 3, 76)], [(0, 3, 74), (3, 2, 78), (5, 2, 82)], [(0, 4, 80), (4, 3, 76)], [(0, 7, 72)]]
    T = 32
    e = 16 / 7
    s.pad(halo, P, (0, T), low=50, vel=48, n=3)
    s.arp(trem, P, (4, T), [0, 1, 2, 1, 0, 1, 2], low=55, vel=48, dur=1)
    s.bass(bass, P, (0, T), pattern=((0, 2, 0), (2, 2, 0), (4, 3, 0)), octave=30, vel=72)
    s.hits(drums, (0, T), [(0, 41, 96), (2 * e, 43, 76), (4 * e, 41, 86), (6 * e, 45, 70)])
    s.hits(drums, (8, T), [(i * e, 42, 40) for i in range(7)])
    s.arp(glass, P, (8, T), [None, None, 3, None, None, 4, None], low=76, vel=40, dur=2)
    form(s, P, M, (horn, 0), (choir, -12), T,
         lambda tr, a, b: s.melody(glass, P, (a, b), 0, 'whole', [[(0, 1), (1, 1), (2, 2), (4, 3)], [(0, 3), (3, 4)]], low=79, high=91, vel=48, cadence=7, seed=14))
    return s, T, True

def vraska():
    # Vraska, the Golgari Queen: E harmonic minor, a snake in the undercity. Oboe, hand drums, pizzicato, bassoon.
    s = Song(132, seed=305)
    oboe = s.ch('oboe', 68, 0, vol=96, pan=60, rev=80)
    tpt = s.ch('trumpet', 59, 1, vol=86, pan=72, rev=80)
    pizz = s.ch('pizz', 45, 2, vol=84, pan=36, rev=60)
    bsn = s.ch('bassoon', 70, 3, vol=86, pan=48, rev=60)
    strings = s.ch('strings', 49, 4, vol=64, rev=100)
    bass = s.ch('bass', 43, 5, vol=80, rev=50)
    drums = s.ch('drums', 0, 9, vol=88, rev=50)
    P = ['Em', 'Em', 'Am', 'B', 'Em', 'C', 'B', 'B']
    M = [[(0, .5, 71), (.5, .5, 72), (1, 1, 71), (2, 1, 67), (3, 1, 64)], [(0, 1, 63), (1, 1, 64), (2, 2, 67)],
         [(0, 1, 69), (1, 1, 72), (2, 1, 76), (3, 1, 72)], [(0, 3, 75), (3, 1, 71)], [(0, 1, 76), (1, 1, 79), (2, 1, 78), (3, 1, 76)],
         [(0, 2, 72), (2, 2, 79)], [(0, 1, 78), (1, 1, 75), (2, 1, 71), (3, 1, 66)], [(0, 4, 71)]]
    T = 32
    s.arp(pizz, P, (0, T), [0, None, 1, 0, None, 2, 1, None], low=52, vel=58, dur=.7)
    s.arp(bsn, P, (4, T), [0, 0, None, 1, 0, None, 2, None], low=40, vel=60, dur=.8)
    s.bass(bass, P, (0, T), pattern=((0, 4, 0),), octave=28, vel=60)
    s.pad(strings, P, (8, T), low=52, vel=40, n=3)
    s.hits(drums, (0, T), [(0, 64, 86), (3, 63, 66), (6, 64, 76), (8, 62, 70), (10, 63, 66), (12, 64, 82), (14, 62, 60)])
    s.hits(drums, (8, T), [(i, 70, 36 + (8 if i % 4 == 0 else 0)) for i in range(0, 16, 2)])
    form(s, P, M, (oboe, 0), (tpt, -12), T,
         lambda tr, a, b: s.melody(tr, P, (a, b), 4, 'harm', [[(0, .5), (.5, .5), (1, 1), (2, 2)], [(0, 1), (1, .5), (1.5, .5), (2, 2)]], low=76, high=88, vel=66, cadence=4, seed=15))
    return s, T, True

def lazav():
    # Lazav, the Dimir master of masks: E minor spy music. Pizzicato ticking, a flute that keeps changing faces.
    s = Song(126, seed=306)
    fl = s.ch('flute', 73, 0, vol=94, pan=64, rev=80)
    clar = s.ch('clarinet', 71, 1, vol=90, pan=50, rev=80)
    vib = s.ch('vibes', 11, 2, vol=72, pan=82, rev=100)
    pizz = s.ch('pizz', 45, 3, vol=82, pan=36, rev=60)
    trem = s.ch('trem', 44, 4, vol=62, rev=110)
    bass = s.ch('bass', 32, 5, vol=88, rev=40)
    drums = s.ch('drums', 0, 9, vol=80, rev=50)
    P = ['Em', 'Em', 'C', 'B7', 'Em', 'G', 'C', 'B7']
    M = [[(0, .5, 76), (.5, .5, 76), (1, .5, 78), (1.5, 1.5, 79), (3, 1, 76)], [(0, 1, 71), (1, 1, 74), (2, 2, 76)],
         [(0, .5, 79), (.5, .5, 79), (1, .5, 81), (1.5, 1.5, 84), (3, 1, 79)], [(0, 2, 78), (2, 2, 75)],
         [(0, 1, 76), (1, 1, 79), (2, 1, 83), (3, 1, 79)], [(0, 2, 79), (2, 2, 74)], [(0, 1, 72), (1, 1, 76), (2, 2, 79)], [(0, 4, 75)]]
    T = 32
    s.arp(pizz, P, (0, T), [0, None, 1, None, 2, None, 1, None, 0, None, 1, None, 2, 1, 0, None], low=52, vel=56, dur=.7)
    s.bass(bass, P, (0, T), pattern=((0, 1, 0), (1.5, .5, 0), (2, 1, 7), (3.5, .5, 12)), octave=36, vel=70)
    s.pad(trem, P, (8, T), low=55, vel=38, n=3)
    s.hits(drums, (0, T), [(0, 36, 80), (8, 36, 70), (4, 37, 56), (12, 37, 60)] + [(i, 42, 38) for i in range(0, 16, 2)])
    # The mask slips: the last section's lead is a different face each pass.
    face = [vib, clar, fl][engine.VAR % 3]
    (la, sa), (lb, sb) = ((clar, -12), (fl, 0)) if engine.VAR == 1 else ((fl, 0), (clar, -12))
    mot(s, la, 8, M, shift=sa, vel=86)
    mot(s, lb, 16, M, shift=sb, vel=82)
    s.melody(vib, P, (16, 24), 4, 'minor', [[(0, .5), (.5, .5), (1, 1), (2, 2)], [(0, 1), (2, 1), (3, 1)]], low=72, high=86, vel=50, cadence=4, rest_prob=.3, seed=16)
    mot(s, face, 24, M, shift=-12 if face == clar else 0, vel=84)
    return s, T, True

def bolas():
    # Nicol Bolas, the final fight: C phrygian dominant, everything at once. Brass, choir, organ, bells, timpani.
    s = Song(144, seed=307)
    brass = s.ch('brass', 61, 0, vol=96, pan=60, rev=80)
    choir = s.ch('choir', 52, 1, vol=84, rev=110)
    organ = s.ch('organ', 19, 2, vol=64, rev=110)
    run = s.ch('strings', 48, 3, vol=78, pan=40, rev=70)
    low = s.ch('low', 42, 4, vol=92, rev=40)
    bell = s.ch('bell', 14, 5, vol=66, pan=84, rev=110)
    timp = s.ch('timp', 47, 6, vol=96, rev=80)
    drums = s.ch('drums', 0, 9, vol=100, rev=50)
    P = ['C', 'Db', 'C', 'Bbm', 'Fm', 'Db', 'Bbm', 'C']
    M = [[(0, 1.5, 72), (1.5, .5, 73), (2, 2, 76)], [(0, 2, 77), (2, 2, 73)], [(0, 1, 72), (1, 1, 76), (2, 1, 79), (3, 1, 76)], [(0, 4, 77)],
         [(0, 1, 77), (1, 1, 80), (2, 2, 84)], [(0, 2, 85), (2, 2, 80)], [(0, 1, 82), (1, 1, 77), (2, 2, 73)], [(0, 4, 72)]]
    T = 32
    s.arp(run, P, (0, T), [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1], low=55, vel=54, dur=.9)
    s.arp(low, P, (0, T), [0, 0, 1, 0, 0, 2, 0, 1], low=36, vel=76, dur=.9)
    s.pad(organ, P, (4, T), low=48, vel=44, n=3)
    s.pad(choir, P, (8, T), low=55, vel=56, n=3)
    s.bass(timp, P, (0, T), pattern=((0, .5, 0), (1.5, .5, 0), (2, .5, 7), (3, .5, 0)), octave=38, vel=92)
    s.hits(drums, (0, T), [(0, 36, 100), (4, 38, 82), (8, 36, 92), (10, 36, 76), (12, 38, 90), (14, 38, 70)])
    s.hits(drums, (0, T), [(0, 49, 96)], every=4)
    for b in range(0, T, 4): s.line(bell, b, [(0, 4, 72)], vel=58)
    form(s, P, M, (brass, 0), (choir, -12), T,
         lambda tr, a, b: s.melody(run, P, (a, b), 5, 'harm', [[(0, .5), (.5, .5), (1, .5), (1.5, .5), (2, 2)], [(0, 1), (1, 1), (2, 1), (3, 1)]], low=79, high=91, vel=68, cadence=4, seed=17))
    return s, T, True

BOSSES = {
    'MUS-BOSS-SORIN': sorin, 'MUS-BOSS-OLIVIA': olivia, 'MUS-BOSS-OB': ob, 'MUS-BOSS-HERALD': herald,
    'MUS-BOSS-VRASKA': vraska, 'MUS-BOSS-LAZAV': lazav, 'MUS-BOSS-BOLAS': bolas,
}
