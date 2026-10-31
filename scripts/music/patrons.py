# The twelve blessing patrons of Planeswalk: one theme each for their blessing screen (MUS-PWG-01..12).
# Low-key and lonely, in the Dark Souls way: a bed, then the patron's own motif, then the motif again on a
# second voice under a quiet counterline. Each motif is hand-written, eight bars over the cue's progression.
import engine
from engine import Song

def mot(s, tr, start_bar, M, shift=0, vel=78, legato=0.95):
    for b, notes in enumerate(M):
        for st, d, p in notes: s.line(tr, start_bar + b, [(st, d, p + shift)], vel=vel, legato=legato)

def leads(a, b):
    """The motif's two voices; the second pass of the loop swaps them."""
    return (b, a) if engine.VAR == 1 else (a, b)

def ugin():
    # Ugin, the Spirit Dragon: C lydian, no pulse. Shakuhachi over choir and a deep drone; ghostfire glints.
    s = Song(54, seed=201)
    choir = s.ch('choir', 91, 0, vol=70, rev=120, cho=40)
    drone = s.ch('drone', 43, 1, vol=72, rev=100)
    shaku = s.ch('shaku', 77, 2, vol=96, pan=56, rev=110)
    horn = s.ch('horn', 60, 3, vol=80, pan=70, rev=110)
    glock = s.ch('glock', 9, 4, vol=50, pan=88, rev=127)
    P = ['Cadd9', 'D/C', 'Em', 'Bm', 'Cadd9', 'D/C', 'Am', 'D']
    M = [[(0, 2, 76), (2, 1, 78), (3, 1, 79)], [(0, 3, 81), (3, 1, 78)], [(0, 2, 79), (2, 2, 76)], [(0, 4, 74)],
         [(0, 1, 76), (1, 1, 79), (2, 2, 81)], [(0, 2, 81), (2, 1, 78), (3, 1, 81)], [(0, 2, 76), (2, 2, 72)], [(0, 4, 74)]]
    T = 24
    s.pad(choir, P, (0, T), low=52, vel=44, n=4)
    s.bass(drone, P, (0, T), pattern=((0, 4, 0),), octave=34, vel=54)
    s.arp(glock, P, (0, T), [None, None, 4, None, None, None, None, 5], low=76, vel=34, dur=3)
    a, b = leads(shaku, horn)
    mot(s, a, 8, M, shift=0 if a == shaku else -12, vel=76)
    mot(s, b, 16, M, shift=0 if b == shaku else -12, vel=68)
    s.melody(shaku if b == horn else horn, P, (16, 24), 0, 'lydian', [[(0, 3), (3, 1)], [(0, 2), (2, 2)]],
             low=64 if b == shaku else 74, high=76 if b == shaku else 86, vel=52, cadence=4, rest_prob=.4, seed=3)
    return s, T, True

def sigarda():
    # Sigarda, Host of Herons: E minor. A weary angel: solo violin, harp and a far-off choir.
    s = Song(60, seed=202)
    choir = s.ch('choir', 52, 0, vol=70, rev=120)
    harp = s.ch('harp', 46, 1, vol=84, pan=40, rev=100)
    vio = s.ch('violin', 40, 2, vol=92, pan=66, rev=100)
    cello = s.ch('cello', 42, 3, vol=84, pan=46, rev=90)
    strings = s.ch('strings', 49, 4, vol=62, rev=110)
    P = ['Em', 'C', 'G', 'D/F#', 'Am', 'Em', 'B', 'Em']
    M = [[(0, 2, 71), (2, 1, 76), (3, 1, 78)], [(0, 3, 79), (3, 1, 76)], [(0, 2, 74), (2, 2, 71)], [(0, 4, 69)],
         [(0, 2, 72), (2, 1, 76), (3, 1, 74)], [(0, 3, 71), (3, 1, 67)], [(0, 2, 66), (2, 2, 75)], [(0, 4, 76)]]
    T = 24
    s.arp(harp, P, (0, T), [0, 2, 1, 3, 2, 4, 3, 2], low=52, vel=46, dur=2.2)
    s.pad(choir, P, (2, T), low=55, vel=38, n=3)
    s.pad(strings, P, (8, T), low=48, vel=36, n=3)
    a, b = leads(vio, cello)
    mot(s, a, 8, M, shift=0 if a == vio else -12, vel=74)
    mot(s, b, 16, M, shift=0 if b == vio else -12, vel=68)
    if b == cello:
        s.melody(vio, P, (16, 24), 4, 'minor', [[(0, 2), (2, 2)], [(0, 3), (3, 1)]], low=76, high=88, vel=54, cadence=4, rest_prob=.3, seed=7)
    else:
        s.bass(cello, P, (16, 24), pattern=((0, 4, 0),), octave=38, vel=50)
    return s, T, True

def geist():
    # Geist of Saint Traft: A minor waltz for a dead hero who still laughs. Music box, pizzicato, bassoon.
    s = Song(92, beats=3, seed=203)
    box = s.ch('musicbox', 10, 0, vol=88, pan=60, rev=110)
    pizz = s.ch('pizz', 45, 1, vol=82, pan=44, rev=70)
    low = s.ch('low', 45, 2, vol=86, rev=60)
    bsn = s.ch('bassoon', 70, 3, vol=88, pan=70, rev=80)
    trem = s.ch('trem', 44, 4, vol=54, rev=120)
    P = ['Am', 'Dm', 'E', 'Am', 'F', 'Dm', 'E7', 'Am']
    M = [[(0, 1, 76), (1, 1, 72), (2, 1, 69)], [(0, 2, 74), (2, 1, 77)], [(0, 1, 76), (1, 1, 71), (2, 1, 68)], [(0, 3, 69)],
         [(0, 1, 72), (1, 1, 77), (2, 1, 81)], [(0, 2, 77), (2, 1, 74)], [(0, 1, 71), (1, 1, 74), (2, 1, 68)], [(0, 3, 69)]]
    T = 24
    s.bass(low, P, (0, T), pattern=((0, 1, 0),), octave=38, vel=64)
    s.arp(pizz, P, (0, T), [None, 1, 1], low=55, vel=46, dur=.8)
    s.arp(pizz, P, (0, T), [None, 2, 2], low=55, vel=42, dur=.8)
    s.pad(trem, P, (16, T), low=55, vel=34, n=3)
    a, b = leads(box, bsn)
    mot(s, a, 0, M, shift=0 if a == box else -12, vel=70)
    mot(s, b, 8, M, shift=0 if b == box else -12, vel=70)
    mot(s, box, 16, M, shift=12 if engine.VAR == 2 else 0, vel=60)
    s.melody(bsn, P, (16, 24), 9, 'harm', [[(0, 1), (1, 1), (2, 1)], [(0, 2), (2, 1)]], low=50, high=62, vel=56, phrase=4, cadence=3, rest_prob=.25, seed=9)
    return s, T, True

def tamiyo():
    # Tamiyo, the Moon Sage: D minor, moonlit and studious. Koto turns pages under a flute; celesta stars.
    s = Song(66, seed=204)
    koto = s.ch('koto', 107, 0, vol=86, pan=40, rev=90)
    fl = s.ch('flute', 73, 1, vol=92, pan=66, rev=100)
    cel = s.ch('celesta', 8, 2, vol=62, pan=84, rev=120)
    pad = s.ch('pad', 89, 3, vol=58, rev=110)
    bass = s.ch('bass', 43, 4, vol=66, rev=90)
    P = ['Dm', 'Am', 'Bb', 'F', 'Dm', 'C', 'Bb', 'Am']
    M = [[(0, 1.5, 74), (1.5, .5, 77), (2, 2, 81)], [(0, 3, 76), (3, 1, 72)], [(0, 2, 74), (2, 2, 77)], [(0, 4, 72)],
         [(0, 1.5, 69), (1.5, .5, 72), (2, 2, 74)], [(0, 3, 79), (3, 1, 76)], [(0, 2, 74), (2, 2, 77)], [(0, 4, 69)]]
    T = 24
    s.arp(koto, P, (0, T), [0, 2, 1, 3, None, 2, 4, None], low=55, vel=50, dur=1.8)
    s.pad(pad, P, (0, T), low=50, vel=36, n=3)
    s.bass(bass, P, (4, T), pattern=((0, 4, 0),), octave=36, vel=50)
    s.arp(cel, P, (8, T), [None, None, None, 5, None, None, 4, None], low=72, vel=36, dur=3)
    a, b = leads(fl, koto)
    mot(s, a, 8, M, shift=0 if a == fl else -12, vel=72)
    mot(s, b, 16, M, shift=0 if b == fl else -12, vel=64)
    if b == koto:
        s.melody(fl, P, (16, 24), 2, 'dorian', [[(0, 2), (2, 2)], [(0, 1), (1, 3)]], low=76, high=88, vel=50, cadence=4, rest_prob=.35, seed=4)
    return s, T, True

def noyan():
    # Noyan Dar, Roil Shaper: D minor, slow and heavy. Cello and contrabass, a far taiko, an ocarina over the ridge.
    s = Song(56, seed=205)
    cello = s.ch('cello', 42, 0, vol=96, pan=50, rev=90)
    drone = s.ch('drone', 43, 1, vol=74, rev=90)
    taiko = s.ch('taiko', 116, 2, vol=78, rev=120)
    strings = s.ch('strings', 49, 3, vol=62, rev=110)
    oca = s.ch('ocarina', 79, 4, vol=78, pan=74, rev=120)
    P = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Gm', 'A', 'Dm']
    M = [[(0, 2, 50), (2, 2, 57)], [(0, 3, 62), (3, 1, 60)], [(0, 2, 58), (2, 2, 53)], [(0, 4, 55)],
         [(0, 2, 57), (2, 1, 60), (3, 1, 62)], [(0, 3, 58), (3, 1, 55)], [(0, 2, 57), (2, 2, 61)], [(0, 4, 62)]]
    T = 24
    s.bass(drone, P, (0, T), pattern=((0, 4, 0),), octave=33, vel=56)
    s.pad(strings, P, (0, T), low=48, vel=36, n=3)
    for b in range(0, T, 2): s.line(taiko, b, [(0, 1, 38)], vel=58 if b % 8 else 70)
    a, b = leads(cello, oca)
    mot(s, a, 8, M, shift=0 if a == cello else 24, vel=76)
    mot(s, b, 16, M, shift=0 if b == cello else 24, vel=60)
    if b == oca:
        s.bass(cello, P, (16, 24), pattern=((0, 2, 0), (2, 2, 7)), octave=40, vel=48)
    s.melody(oca if a == cello else cello, P, (0, 8), 2, 'dorian', [[(0, 3), (3, 1)], [(0, 4)]],
             low=74 if a == cello else 50, high=86 if a == cello else 62, vel=44, cadence=4, rest_prob=.5, seed=5)
    return s, T, True

def kiora():
    # Kiora, the Tide's Fury: E dorian in a swaying 6/8. Marimba waves, harp spray, a sly clarinet.
    s = Song(84, beats=6, unit=8, seed=206)
    mar = s.ch('marimba', 12, 0, vol=84, pan=40, rev=80)
    harp = s.ch('harp', 46, 1, vol=72, pan=80, rev=100)
    clar = s.ch('clarinet', 71, 2, vol=92, pan=60, rev=90)
    pad = s.ch('pad', 49, 3, vol=58, rev=110)
    bass = s.ch('bass', 32, 4, vol=78, rev=50)
    drums = s.ch('drums', 0, 9, vol=60, rev=60)
    P = ['Em', 'D', 'C', 'D', 'Em', 'Am', 'D', 'B7']
    M = [[(0, 2, 71), (2, 1, 74), (3, 2, 76), (5, 1, 79)], [(0, 3, 78), (3, 2, 74), (5, 1, 73)], [(0, 2, 72), (2, 1, 76), (3, 3, 79)], [(0, 6, 78)],
         [(0, 2, 79), (2, 1, 78), (3, 2, 76), (5, 1, 74)], [(0, 3, 72), (3, 3, 69)], [(0, 2, 66), (2, 1, 69), (3, 3, 74)], [(0, 6, 75)]]
    T = 24
    s.arp(mar, P, (0, T), [0, 1, 2, 3, 2, 1], low=55, vel=48, dur=1.2)
    s.pad(pad, P, (0, T), low=50, vel=34, n=3)
    s.bass(bass, P, (4, T), pattern=((0, 3, 0), (3, 3, 7)), octave=36, vel=54)
    e = 16 / 6
    s.hits(drums, (8, T), [(0, 70, 34), (2 * e, 70, 22), (3 * e, 70, 30), (5 * e, 70, 22)])
    a, b = leads(clar, mar)
    mot(s, a, 8, M, shift=0 if a == clar else 0, vel=70)
    mot(s, b, 16, M, shift=0, vel=60)
    s.arp(harp, P, (16, T), [None, None, None, 4, 5, 6], low=67, vel=40)
    return s, T, True

def anowon():
    # Anowon, the Ruin Sage: C minor, cold and polite. Harpsichord turning, low organ, a solo viola.
    s = Song(60, seed=207)
    hpsd = s.ch('harpsichord', 6, 0, vol=74, pan=44, rev=90)
    organ = s.ch('organ', 19, 1, vol=56, rev=110)
    viola = s.ch('viola', 41, 2, vol=94, pan=64, rev=100)
    bass = s.ch('bass', 43, 3, vol=70, rev=90)
    bell = s.ch('bell', 14, 4, vol=46, pan=86, rev=127)
    P = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Ddim', 'G7']
    M = [[(0, 2, 67), (2, 1, 63), (3, 1, 60)], [(0, 3, 68), (3, 1, 72)], [(0, 2, 68), (2, 2, 65)], [(0, 2, 71), (2, 2, 67)],
         [(0, 1, 72), (1, 1, 75), (2, 2, 79)], [(0, 3, 75), (3, 1, 72)], [(0, 2, 74), (2, 2, 77)], [(0, 4, 71)]]
    T = 24
    s.arp(hpsd, P, (0, T), [0, 1, 2, 1, 3, 2, 1, 2], low=48, vel=44, dur=1.6)
    s.pad(organ, P, (0, T), low=48, vel=34, n=3)
    s.bass(bass, P, (8, T), pattern=((0, 4, 0),), octave=36, vel=50)
    for b in range(0, T, 4): s.line(bell, b, [(0, 4, 72)], vel=34)
    a, b = leads(viola, hpsd)
    mot(s, a, 8, M, vel=72)
    mot(s, b, 16, M, shift=12 if b == hpsd else 0, vel=58 if b == hpsd else 66)
    if b == hpsd:
        s.melody(viola, P, (16, 24), 0, 'harm', [[(0, 3), (3, 1)], [(0, 2), (2, 2)]], low=55, high=67, vel=52, cadence=4, rest_prob=.3, seed=6)
    return s, T, True

def zada():
    # Zada, Hedron Grinder: a goblin who hits rocks to see what falls out. F major with a wrong turn to Db.
    s = Song(100, seed=208)
    bsn = s.ch('bassoon', 70, 0, vol=92, pan=56, rev=70)
    pizz = s.ch('pizz', 45, 1, vol=82, pan=40, rev=60)
    xylo = s.ch('xylo', 13, 2, vol=70, pan=80, rev=80)
    strings = s.ch('strings', 49, 3, vol=54, rev=100)
    drums = s.ch('drums', 0, 9, vol=72, rev=60)
    P = ['F', 'F', 'Bb', 'C', 'F', 'Db', 'C', 'C']
    M = [[(0, 1, 53), (1, .5, 57), (1.5, .5, 60), (2, 1, 65), (3, 1, 60)], [(0, .5, 62), (.5, .5, 64), (1, 2, 65), (3, 1, 57)],
         [(0, 1, 58), (1, 1, 62), (2, 2, 65)], [(0, 1, 64), (1, 1, 60), (2, 2, 55)],
         [(0, .5, 65), (.5, .5, 64), (1, .5, 62), (1.5, .5, 60), (2, 2, 57)], [(0, 1, 56), (1, 1, 61), (2, 2, 65)],
         [(0, 2, 64), (2, 1, 67), (3, 1, 70)], [(0, 4, 60)]]
    T = 24
    s.bass(pizz, P, (0, T), pattern=((0, 1, 0), (2, 1, 7)), octave=36, vel=62)
    s.pad(strings, P, (8, T), low=53, vel=32, n=3)
    s.hits(drums, (0, T), [(0, 76, 52), (4, 77, 38), (8, 76, 48), (12, 77, 38)])
    a, b = leads(bsn, xylo)
    mot(s, a, 8, M, shift=0 if a == bsn else 24, vel=72 if a == bsn else 56)
    mot(s, b, 16, M, shift=0 if b == bsn else 24, vel=66 if b == bsn else 52)
    s.melody(xylo if a == bsn else bsn, P, (0, 8), 5, 'major', [[(0, .5), (.5, .5), (1, 1)], [(0, 1), (2, 1)]],
             low=72 if a == bsn else 50, high=86 if a == bsn else 64, vel=44, cadence=2, rest_prob=.35, seed=8)
    # Every few bars something falls out of the hedron.
    import random
    r = random.Random(30 + engine.VAR)
    for bar in range(3, T, 4): s.line(xylo, bar, [(r.choice((2.5, 3, 3.5)), .5, r.choice((84, 85, 89, 91)))], vel=48)
    return s, T, True

def teferi():
    # Teferi, Master of Time: A minor, calm. Kalimba in threes against a clock in fours; a warm horn.
    s = Song(70, seed=209)
    kal = s.ch('kalimba', 108, 0, vol=84, pan=40, rev=90)
    horn = s.ch('horn', 60, 1, vol=90, pan=62, rev=100)
    strings = s.ch('strings', 49, 2, vol=60, rev=110)
    bass = s.ch('bass', 43, 3, vol=70, rev=90)
    drums = s.ch('drums', 0, 9, vol=58, rev=70)
    vib = s.ch('vibes', 11, 4, vol=56, pan=84, rev=110)
    P = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E']
    M = [[(0, 2, 64), (2, 2, 69)], [(0, 3, 72), (3, 1, 69)], [(0, 2, 67), (2, 2, 64)], [(0, 4, 62)],
         [(0, 1, 64), (1, 1, 67), (2, 2, 69)], [(0, 2, 65), (2, 2, 72)], [(0, 2, 69), (2, 2, 65)], [(0, 4, 64)]]
    T = 24
    s.arp(kal, P, (0, T), [0, 1, 2] * 4, low=60, vel=44, dur=1.2)
    s.hits(drums, (0, T), [(0, 75, 36), (4, 75, 26), (8, 75, 32), (12, 75, 26)])
    s.pad(strings, P, (4, T), low=50, vel=36, n=3)
    s.bass(bass, P, (8, T), pattern=((0, 4, 0),), octave=36, vel=50)
    a, b = leads(horn, vib)
    mot(s, a, 8, M, shift=0 if a == horn else 12, vel=70)
    mot(s, b, 16, M, shift=0 if b == horn else 12, vel=60)
    return s, T, True

def niv():
    # Niv-Mizzet, the Firemind: E lydian, a mind that never stops. Running strings, a lordly horn, sparks.
    s = Song(100, seed=210)
    run = s.ch('strings', 48, 0, vol=70, pan=44, rev=80)
    horn = s.ch('horn', 60, 1, vol=92, pan=60, rev=90)
    harp = s.ch('harp', 46, 2, vol=66, pan=80, rev=100)
    glock = s.ch('glock', 9, 3, vol=52, pan=90, rev=110)
    bass = s.ch('bass', 43, 4, vol=72, rev=80)
    timp = s.ch('timp', 47, 5, vol=70, rev=100)
    P = ['E', 'F#/E', 'Eaug', 'A', 'C#m', 'F#', 'A', 'B']
    M = [[(0, 1, 64), (1, 1, 68), (2, 2, 71)], [(0, 2, 73), (2, 1, 70), (3, 1, 73)], [(0, 3, 72), (3, 1, 68)], [(0, 4, 69)],
         [(0, 1, 68), (1, 1, 71), (2, 2, 76)], [(0, 2, 73), (2, 2, 70)], [(0, 2, 69), (2, 2, 73)], [(0, 4, 71)]]
    T = 24
    s.arp(run, P, (0, T), [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1], low=55, vel=40, dur=.9)
    s.bass(bass, P, (0, T), pattern=((0, 4, 0),), octave=36, vel=52)
    s.bass(timp, P, (8, T), pattern=((0, .5, 0),), octave=38, vel=46)
    s.arp(glock, P, (8, T), [None] * 7 + [5], low=79, vel=36, dur=2)
    a, b = leads(horn, harp)
    mot(s, a, 8, M, shift=0 if a == horn else 12, vel=72)
    mot(s, b, 16, M, shift=0 if b == horn else 12, vel=62)
    return s, T, True

def kaya():
    # Kaya, Ghost Assassin: G minor noir. Muted trumpet, walking bass, brushed ride, a church organ for Orzhov.
    s = Song(76, seed=211)
    tpt = s.ch('trumpet', 59, 0, vol=92, pan=60, rev=90)
    bass = s.ch('bass', 32, 1, vol=86, pan=50, rev=40)
    organ = s.ch('organ', 19, 2, vol=50, rev=110)
    vib = s.ch('vibes', 11, 3, vol=66, pan=80, rev=100)
    drums = s.ch('drums', 0, 9, vol=62, rev=60)
    P = ['Gm', 'Gm', 'Cm', 'D7', 'Gm', 'Eb', 'Cm', 'D7']
    M = [[(0, 1.5, 70), (1.5, .5, 69), (2, 2, 67)], [(0, 1, 74), (1, 1, 72), (2, 2, 70)], [(0, 2, 67), (2, 1, 63), (3, 1, 60)], [(0, 4, 66)],
         [(0, 1.5, 74), (1.5, .5, 77), (2, 2, 79)], [(0, 2, 75), (2, 2, 70)], [(0, 2, 72), (2, 2, 67)], [(0, 4, 69)]]
    T = 24
    s.bass(bass, P, (0, T), pattern=((0, 1, 0), (1, 1, 7), (2, 1, 12), (3, 1, 7)), octave=36, vel=60)
    s.pad(organ, P, (0, T), low=50, vel=32, n=3)
    s.hits(drums, (0, T), [(0, 51, 40), (4, 51, 34), (6, 51, 24), (8, 51, 40), (12, 51, 34), (14, 51, 24), (4, 44, 28), (12, 44, 28)])
    s.stabs(vib, P, (4, T), [6, 14], low=60, vel=40, n=3, dur=1.2)
    a, b = leads(tpt, vib)
    mot(s, a, 8, M, shift=0, vel=72)
    mot(s, b, 16, M, shift=0, vel=60)
    return s, T, True

def rakdos():
    # Rakdos, Lord of Riots: a D minor carnival waltz, slow enough to leer. Calliope, tuba, accordion, low choir.
    s = Song(116, beats=3, seed=212)
    call = s.ch('calliope', 82, 0, vol=80, pan=60, rev=90)
    tuba = s.ch('tuba', 58, 1, vol=86, rev=60)
    acc = s.ch('accordion', 21, 2, vol=68, pan=40, rev=80)
    choir = s.ch('choir', 52, 3, vol=60, rev=120)
    drums = s.ch('drums', 0, 9, vol=58, rev=70)
    P = ['Dm', 'A7', 'Dm', 'Gm', 'Dm', 'Bb', 'A7', 'Dm']
    M = [[(0, 1, 74), (1, .5, 73), (1.5, 1.5, 74)], [(0, 1, 76), (1, 1, 79), (2, 1, 73)], [(0, 2, 77), (2, 1, 74)], [(0, 1, 70), (1, 1, 74), (2, 1, 79)],
         [(0, 1, 81), (1, 1, 77), (2, 1, 74)], [(0, 2, 82), (2, 1, 77)], [(0, 1, 76), (1, 1, 73), (2, 1, 79)], [(0, 3, 74)]]
    T = 24
    s.bass(tuba, P, (0, T), pattern=((0, 1, 0),), octave=36, vel=62)
    s.arp(acc, P, (0, T), [None, 1, 1], low=57, vel=40, dur=.7)
    s.arp(acc, P, (0, T), [None, 2, 2], low=57, vel=36, dur=.7)
    s.pad(choir, P, (8, T), low=45, vel=34, n=3)
    s.hits(drums, (8, T), [(0, 41, 42)])
    a, b = leads(call, acc)
    mot(s, a, 8, M, shift=0 if a == call else -12, vel=66)
    mot(s, b, 16, M, shift=0 if b == call else -12, vel=58)
    return s, T, True

PATRONS = {
    'MUS-PWG-01': ugin, 'MUS-PWG-02': sigarda, 'MUS-PWG-03': geist, 'MUS-PWG-04': tamiyo,
    'MUS-PWG-05': noyan, 'MUS-PWG-06': kiora, 'MUS-PWG-07': anowon, 'MUS-PWG-08': zada,
    'MUS-PWG-09': teferi, 'MUS-PWG-10': niv, 'MUS-PWG-11': kaya, 'MUS-PWG-12': rakdos,
}
