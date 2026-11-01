# Every sound effect, by cue ID (the IDs the game already plays). Each recipe layers real sampled instruments
# with designed foley from kit.py. Written to the brief in /mnt/project-files/audio/cardstashy-sound-cues.csv.
from kit import *

CUES = {}
def cue(*ids):
    def reg(fn):
        for i in ids: CUES[i] = fn
        return fn
    return reg
def mf(p): return 440 * 2 ** ((p - 69) / 12)

# ---------------------------------------------------------------------------- shared building blocks
def tick(f=1100, bright=.5): return mix((wood(f, .09), 0, 1), (paper(.02, 7000), 0, bright * .4))
def knock(f=420): return mix((wood(f, .14), 0, 1), (thump(220, 90, .09, .02, .2), 0, .6))
def card_snap(bright=6500, up=True):
    return mix((whoosh(.12, 900, 5000 if up else 1500, 2, .7), 0, .35), (snap(bright), .07, 1))
def card_slide(sec=.18, bright=3500): return mix((whoosh(sec, 1200, bright, 1.2, .5, 'white'), 0, .6), (paper(.03, bright), sec * .8, .5))
def card_slam(weight=1.0):
    return verb(mix((thump(140 - 30 * weight, 42, .35 + .25 * weight, .05, .5), 0, 1), (paper(.05, 3500), 0, .9),
                    (burst(.12, 120, 900, .04, 'pink'), 0, .5 * weight)), .14, .8, 2500)
def shimmer(lo=84, hi=100, sec=.35, prog=CELESTA, vel=60, up=True):
    return gliss(prog, lo, hi, sec, vel, (0, 2, 4, 7, 9, 11), up, .5)
def sparkle(n=8, sec=.4, lo=3500, hi=9000):
    return mix(*[(st(glass(rng.uniform(lo, hi), rng.uniform(.06, .2)) * rng.uniform(.3, 1), rng.uniform(-.6, .6)), rng.uniform(0, sec), .5) for _ in range(n)])
def cast_whoosh(sec=.45, f1=4500): return whoosh(sec, 250, f1, 1.4, .55, 'pink', -.3, .3)
def magic_bloom(root=72, prog=CELESTA): return mix((chord(prog, [root, root + 4, root + 7, root + 11], 0, 1.0, 70, .03), 0, .8), (sparkle(6, .5), .05, .5))
def horn_call(ps, vel=96, prog=HORN, step=.22, last=.7):
    return inst(prog, [(i * step, (last if i == len(ps) - 1 else step * 1.05), p, vel) for i, p in enumerate(ps)])
def cym_swell(sec=1.0):
    c = rev(drum([(0, 2, 49, 90)])[:N(1.8)]); return c[-N(sec):] if len(c) > N(sec) else c
def drum_roll(sec=.8, note=38, vel=70, crescendo=True):
    n = int(sec / .045); return drum([(i * .045, .05, note, int(vel * (.5 + .5 * i / n) if crescendo else vel)) for i in range(n)])
def timp_roll(p=41, sec=.9, vel=80):
    n = int(sec / .06); return inst(TIMP, [(i * .06, .1, p, int(vel * (.4 + .6 * i / n))) for i in range(n)] + [(sec, 1.5, p, vel + 20)])
def gong(f=110, sec=4):
    return verb(mix((metal(f, sec, .7), 0, .8), (bell(f * 2, sec * .8), 0, .5), (thump(90, 40, .5, .1, .1), 0, .4)), .3, 2.2, 2200)
def whisper(sec=.8, lo=1500, hi=6000):
    x = noise(sec, 'pink'); x = bp(x, lo, hi)
    t = np.arange(len(x)) / SR; am = (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(5, 9) * t)) * env_ar(len(x), .3, .7)
    x = x * am; x = mix((st(x, -.3), 0, 1), (st(rev(x), .3), .05, .6))
    return x / (np.abs(x).max() + 1e-9)
def creak(sec=.5, f=180):
    t = np.arange(N(sec)) / SR; ph = np.cumsum(f * (1 + .25 * np.sin(2 * np.pi * 3 * t))) / SR
    pulses = (np.sin(2 * np.pi * ph) > .96).astype(float)
    x = signal.lfilter([1], [1, -.97], pulses * rng.uniform(.5, 1, len(t)))
    x = bp(x, 300, 3000) * env_ar(len(t), .2, .5)
    return x / (np.abs(x).max() + 1e-9)
def cloth(sec=.25, up=True):
    x = sweep_bp(noise(sec, 'pink'), 600 if up else 2500, 2500 if up else 600, .9)
    t = np.arange(len(x)) / SR; x *= (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 14 * t))) * env_ar(len(x), .3 if up else .1, .7 if up else .9)
    return x / (np.abs(x).max() + 1e-9)
def quill(sec=.5):
    x = bp(noise(sec), 2500, 9000); t = np.arange(len(x)) / SR
    am = np.clip(np.sin(2 * np.pi * 11 * t + 2 * np.sin(2 * np.pi * 3 * t)), 0, 1) ** 2
    return x * am * env_ar(len(x), .1, .9)
def pouch(): return mix((thump(110, 60, .18, .03, .1), 0, 1), (burst(.08, 200, 1500, .03, 'pink'), 0, .6))
def lute(ps, t=0, vel=80, strum=.0, dur=.8): return inst(NYLON, [(t + i * strum, dur, p, vel) for i, p in enumerate(ps)])
def two_note(a, b, prog=NYLON, step=.12, vel=82, dur=.5): return inst(prog, [(0, step * 1.4, a, vel), (step, dur, b, vel)])

# ---------------------------------------------------------------------------- app layer (silent by Randall's rule; kept for completeness)
@cue('APP-001')
def _(): return verb(mix((gliss(HARP, 55, 79, .6, 80, (0, 2, 4, 7, 9)), 0, .8), (chord(BRASS, [55, 62, 67, 71], .5, 1.6, 70), 0, .6), (thump(90, 45, .5, .08, .3), .5, .6), (sparkle(8, .8), .6, .4)), .28, 1.8)
@cue('APP-003')
def _(): return knock(520)
@cue('APP-004')
def _(): return lp(knock(380), 2500)
@cue('APP-005')
def _(): return mix((cloth(.14), 0, .7), (tick(1300), .13, .5))
@cue('APP-006')
def _(): return mix((paper(.12, 3000), 0, .6), (crystal_ping(mf(88), .3), .04, .25))
@cue('APP-007')
def _(): return verb(cloth(.26, True), .1, .6)
@cue('APP-008')
def _(): return verb(cloth(.18, False), .08, .5)
@cue('APP-009')
def _(): return mix((metal(3200, .08), 0, .5), (tick(1600), 0, .6))
@cue('APP-010')
def _(): return wood(2200, .04)
@cue('APP-011')
def _(): return whoosh(.08, 800, 2000, 1, .5) * .3
@cue('APP-012')
def _(): return verb(two_note(52, 51, NYLON, .11, 70, .35), .1, .7)
@cue('APP-013')
def _(): return verb(mix((two_note(67, 74, NYLON, .1, 80, .45), 0, 1), (crystal_ping(mf(98), .4), .12, .3)), .15, .9)
@cue('APP-014')
def _(): return verb(mix((bell(mf(91), .6), 0, .6), (sparkle(5, .25), .03, .4)), .2, .9)
@cue('APP-015')
def _(): return mix((whoosh(.35, 400, 3000), 0, .5), (tick(1200), .38, .7))
@cue('APP-016')
def _(): return quill(.04)
@cue('APP-017')
def _(): return mix(*[(snap(5000 + i * 300), i * .035, .6) for i in range(8)])
@cue('APP-018')
def _(): return verb(mix((metal(2600, .05), 0, .7), (snap(9000), 0, .6), (chord(CELESTA, [84, 88, 91], .05, .4, 70), 0, .6)), .15, .8)
@cue('APP-019')
def _(): return mix((inst(NYLON, [(0, .4, 45, 70)]), 0, .7), (whoosh(.3, 2000, 500), .05, .3))
@cue('APP-020')
def _(): return verb(inst(HARP, [(0, .5, 62, 80), (.25, .5, 69, 80), (.5, .9, 74, 80)]), .25, 1.4)

# ---------------------------------------------------------------------------- collection and packs (silent by rule)
@cue('COL-001')
def _(): return mix((card_slide(.15, 3000), 0, .8), (whoosh(.15, 800, 2500), 0, .3))
@cue('COL-002')
def _(): return mix((paper(.04, 2500), 0, .8), (thump(160, 80, .08, .02, .1), 0, .3))
@cue('COL-003')
def _(): return mix((whoosh(.1, 1000, 4000), 0, .3), (snap(7000), .06, 1))
@cue('COL-004')
def _(): return verb(glass(1800, 1.2), .3, 1.2) * .5
@cue('COL-005')
def _():
    # Added to collection, a deck or a binder: a card slides into a sleeve, then a soft celesta fifth.
    return verb(mix((lp(card_slide(.16, 2600), 6000), 0, .6), (inst(CELESTA, [(.12, .5, 79, 58), (.22, .8, 86, 52)]), 0, .7)), .25, 1.2, 5000)
@cue('COL-006')
def _(): return pitch(mix((card_slide(.2, 2800), 0, .8)), .85)
@cue('COL-007')
def _(): return verb(mix((knock(300), 0, 1), (two_note(67, 74, NYLON, .1, 70), .12, .7)), .12, .8)
@cue('COL-008')
def _(): return mix((knock(260), 0, .7), (knock(240), .06, .5), (CUES['APP-012'](), .1, .8))
@cue('COL-009')
def _(): return mix((coin(3800), 0, .7), (coin(4600), .12, .8))
@cue('COL-010', 'CARD-024')
def _(): return mix(*[(snap(4500 + rng.uniform(-800, 800)), i * .022, rng.uniform(.4, .8)) for i in range(26)], (paper(.08, 3000), .62, .8))
@cue('PACK-002')
def _(): return mix((whoosh(.45, 300, 1800, 1.2, .6, 'white'), 0, .6), (inst(SLOWSTR, [(0, .6, 50, 50)]), 0, .3))
# Pack opening in the main app: gentle, never a fanfare (Randall, 1 Nov). Rarer pulls get warmer, not louder.
@cue('PACK-003')
def _():
    # A rare is waiting face down: a low warm hum with a faint shimmer.
    return verb(mix((inst(SLOWSTR, [(0, 1.3, 50, 45), (0, 1.3, 57, 40)]), 0, .7), (inst(CHOIR, [(.1, 1.2, 62, 30)]), 0, .3), (shimmer(88, 100, .9, CELESTA, 28), .3, .3)), .35, 1.6, 3500)
@cue('PACK-004')
def _():
    tear = hp(noise(.32), 1800) * (np.abs(np.sin(np.linspace(0, 80, N(.32)))) ** 6) * env_ar(N(.32), .1, .9)
    return verb(mix((lp(tear, 7000), 0, .8), (whoosh(.3, 700, 4000), .18, .3), (sparkle(5, .3, 3000, 7000), .24, .25)), .2, 1.0, 5000)
@cue('PACK-005')
def _():
    # One card lands on the table: a soft paper tap on felt.
    return mix((lp(paper(.035, 2600), 6000), 0, .8), (thump(190, 110, .06, .015, .05), 0, .25))
@cue('PACK-006', 'PACK-011')
def _(): return lp(mix((whoosh(.08, 900, 3000), 0, .25), (snap(5200), .05, .8)), 7000)
@cue('PACK-007')
def _(): return verb(mix((CUES['PACK-006'](), 0, 1), (glass(mf(93), .35), .06, .18)), .2, 1.0, 6000)
@cue('PACK-008')
def _():
    # Rare: three warm celesta notes rising over a soft choir.
    return verb(mix((CUES['PACK-006'](), 0, .9), (inst(CELESTA, [(.06, .5, 76, 62), (.16, .5, 79, 62), (.26, .9, 84, 64)]), 0, .7),
                    (inst(CHOIR, [(.06, 1.0, 64, 38), (.06, 1.0, 71, 34)]), 0, .35)), .3, 1.4, 5000)
@cue('PACK-009')
def _():
    # Mythic or better: a harp sweep into a warm major chord, strings and choir, all soft.
    return verb(mix((CUES['PACK-006'](), 0, .9), (gliss(HARP, 67, 96, .55, 60, (0, 2, 4, 7, 9)), .05, .6),
                    (inst(SLOWSTR, [(.45, 1.6, p, 50) for p in (55, 62, 67, 71)]), 0, .55), (inst(CHOIR, [(.45, 1.5, p, 42) for p in (67, 71, 74)]), 0, .4),
                    (sparkle(7, .8, 3500, 8000), .5, .25)), .35, 1.8, 4500)
@cue('PACK-010')
def _(): return verb(mix((whoosh(.55, 2500, 9000, 2, .5, 'white', -.8, .8), 0, .4), (shimmer(88, 108, .5, CELESTA, 50), 0, .5)), .25, 1.2)
@cue('PACK-012')
def _(): return verb(mix((bell(mf(93), .5), 0, .5), (quill(.25), .1, .4)), .2, .9)
@cue('PACK-013')
def _(): return verb(mix((chord(NYLON, [55, 59, 62, 67], 0, .7, 70, .03), 0, .7), (chord(NYLON, [52, 55, 60, 64], .6, .7, 70, .03), 0, .7), (chord(NYLON, [50, 55, 59, 62], 1.2, 1.2, 75, .03), 0, .8),
                         (inst(SLOWSTR, [(0, .65, 43, 50), (.6, .65, 48, 50), (1.2, 1.4, 43, 55)]), 0, .4)), .25, 1.5)

# ---------------------------------------------------------------------------- match flow
@cue('QP-002')
def _(): return verb(mix((creak(.4, 120), 0, .6), (knock(180), .35, 1), (horn_call([55, 62], 70), .55, .5)), .3, 1.8)
@cue('QP-004')
def _(): return lp(thump(70, 40, .25, .04, .05), 400) * .6
@cue('QP-005')
def _(): return verb(mix((creak(.25, 140), 0, .4), (knock(200), .2, .8), (inst(HORN, [(.2, .2, 55, 60)]), 0, .4)), .25, 1.5)
@cue('QP-006')
def _(): return verb(mix((cym_swell(.6), 0, .4), (horn_call([60, 67, 72], 105, TRUMPET, .1, .8), .55, .9), (drum([(.55, .5, 49, 90)]), 0, .5)), .25, 1.6)
@cue('QP-007')
def _():
    slam = lambda pan: st(mono(mix((thump(110, 38, .45, .05, .6), 0, 1), (metal(700, .25, .5), 0, .45), (burst(.1, 200, 3000, .03), 0, .6))), pan)
    return verb(mix((slam(-.6), 0, 1), (slam(.6), .32, 1), (chord(BRASS, [43, 50, 55, 58], .7, .6, 110), 0, .8), (inst(TREM, [(.95, 1.0, p, 60 + i * 10) for i, p in enumerate((62, 67, 70))]), 0, .5)), .25, 1.6)
@cue('QP-008')
def _(): return verb(mix((inst(TIMP, [(0, .6, 38, 110)]), 0, .9), (whoosh(.5, 300, 2500, 1.2, .3, 'pink', -.6, .6), .08, .5)), .25, 1.5)
@cue('QP-009')
def _():
    t = np.arange(N(1.2)) / SR; x = coin(4200)
    ring = modal([4200, 6170, 8780], [.8, .5, .3], sec=1.2) * (0.55 + 0.45 * np.sin(2 * np.pi * (14 - 8 * t / 1.2) * t))
    return verb(mix((x, 0, .6), (ring, 0, .6)), .15, .9)
@cue('QP-010')
def _(): return verb(mix((coin(4000), 0, .8), (wood(700, .1), 0, .5), (two_note(72, 79, HARP, .12, 85, .6), .12, .8)), .2, 1.2)
@cue('QP-011')
def _(): return verb(mix((coin(4000), 0, .8), (wood(700, .1), 0, .5), (two_note(79, 74, HARP, .12, 80, .6), .12, .8)), .2, 1.2)
@cue('QP-012')
def _(): return card_snap(7000)
@cue('QP-013')
def _(): return verb(mix((paper(.04, 2500), 0, .7), (thump(180, 90, .08, .02, .2), 0, .4), (lute([55, 59, 62, 67], .08, 82, .025), 0, .8)), .18, 1.0)
@cue('QP-014')
def _(): return mix((card_slide(.3, 2500), 0, .7), (CUES['COL-010'](), .25, .7))
@cue('QP-015')
def _(): return lp(card_slide(.22, 2200), 5000)
@cue('QP-016')
def _(): return verb(mix((drum_roll(.8, 41, 90), 0, .7), (inst(TIMP, [(0, .9, 38, 70)] + [(i * .06, .1, 38, 50 + i * 4) for i in range(13)]), 0, .6), (gong(98, 3), .85, .9), (bell(mf(74), 2.5), .85, .4)), .25, 2.0)
@cue('QP-017')
def _(): return verb(mix((horn_call([60, 64, 67, 72], 110, TRUMPET, .14, 1.4), 0, .9), (chord(BRASS, [48, 55, 60, 64], .42, 1.6, 100), 0, .7), (drum([(.42, 1.6, 49, 100)]), 0, .6), (gliss(HARP, 72, 96, .6, 70), .45, .5)), .3, 2.0)
@cue('QP-018')
def _(): return verb(mix((inst(CHOIR, [(0, 2.4, p, 70) for p in (45, 52, 57, 60)]), 0, .7), (inst(SLOWSTR, [(0, 1.2, 57, 70), (1.0, 2, 56, 70)]), 0, .7), (gong(82, 4), .1, .6)), .35, 2.4)
@cue('QP-019')
def _(): return verb(mix((inst(SLOWSTR, [(0, 2.5, p, 60) for p in (55, 60, 62, 67)]), 0, .7), (gliss(HARP, 67, 86, .6, 60, (0, 2, 5, 7, 9)), .2, .5)), .35, 2.4)
@cue('QP-020')
def _(): return verb(mix((cloth(.4), 0, .6), (bell(mf(55), 2), .3, .6)), .3, 2.0)
@cue('QP-021')
def _(): return verb(mix((lp(knock(160), 1200), 0, .6), (horn_call([67, 72], 90, TRUMPET, .14, .5), .35, .6)), .35, 2.0)
@cue('QP-022')
def _(): return mix(*[(st(coin() * rng.uniform(.4, .9), rng.uniform(-.4, .4)), (i / 18) ** 1.4 * 1.2, 1) for i in range(18)], (pouch(), 1.35, .9), (coins(4, .05), 1.35, .5))
@cue('QP-023')
def _(): return verb(mix((gliss(HARP, 60, 96, .7, 80), 0, .8), (chord(TUBULAR, [72, 76, 79], .65, 1.5, 80), 0, .6)), .3, 1.8)
@cue('QP-024')
def _(): return mix((whoosh(.3, 2500, 500), 0, .5), (CUES['APP-008'](), .2, .6))

# ---------------------------------------------------------------------------- turns
@cue('TT-001')
def _(): return verb(mix((horn_call([67, 72], 100, HORN, .2, .8), 0, .9), (cym_swell(.5), 0, .3)), .28, 1.6)
@cue('TT-002')
def _(): return verb(lp(mix((horn_call([60, 55], 90, HORN, .22, .7), 0, .9)), 2500), .3, 1.6)
@cue('TT-003')
def _(): return tick(1500, .3)
@cue('TT-004')
def _(): return mix((knock(600), 0, .7), (whoosh(.14, 600, 3500, 1.2, .3), .02, .4))
@cue('TT-005')
def _(): return quill(.25) * .5
@cue('TT-006')
def _(): return crackle(1.0, 120, 2500, 10000, .1) * .5
@cue('TT-007')
def _(): return mix((crackle(1.0, 220, 2500, 10000, .15), 0, .5), (wood(1800, .05), 0, .6), (wood(1800, .05), .5, .6))
@cue('TT-008')
def _(): return mix((crackle(.3, 150, 2500, 9000, .1), 0, .5), (burst(.2, 300, 2500, .06, 'pink'), .25, .6))
@cue('TT-009')
def _(): return mix((metal(2400, .12, .6), 0, .6), (tick(1400), 0, .5))
@cue('TT-010')
def _(): return mix(*[(paper(.04, 3000), i * .025, .5) for i in range(6)])

# ---------------------------------------------------------------------------- cards
@cue('CARD-001')
def _(): return card_snap(6500)
@cue('CARD-002')
def _(): return lp(st(mono(card_snap(5500)), .4), 5000) * .6
@cue('CARD-003')
def _(): return mix((whoosh(.12, 700, 2500, 1.2, .4), 0, .5), (paper(.03, 3000), 0, .4))
@cue('CARD-004')
def _(): return lp(card_slide(.14, 2500), 5000)
@cue('CARD-005')
def _(): return verb(mix((thump(100, 45, .4, .05, .3), 0, 1), (paper(.04, 3000), 0, .7), (burst(.18, 80, 600, .06, 'brown'), 0, .6), (inst(KALIMBA, [(.02, .4, 55, 50)]), 0, .25)), .2, 1.0, 2000)
@cue('CARD-006')
def _(): return verb(mix((crystal_ping(mf(91), .35), 0, .6), (tick(2000), 0, .2)), .2, .8)
@cue('CARD-007')
def _(): return verb(shimmer(79, 91, .25, CELESTA, 50), .25, 1.0)
@cue('CARD-008', 'PWB-006')
def _(): return verb(mix((cast_whoosh(.45), 0, .7), (shimmer(76, 96, .35, CELESTA, 62), .1, .6), (gliss(HARP, 62, 86, .3, 60), .05, .4)), .3, 1.4)
@cue('CARD-009')
def _(): return lp(inst(CHOIR, [(0, 1.5, 48, 40), (0, 1.5, 55, 40)]), 1200) * .5
@cue('CARD-010', 'PWB-005')
def _(): return mix((card_slam(1.0), 0, 1), (magic_bloom(67, CELESTA), .02, .3), (CUES['_fiddle_flourish'](), .05, .35))
@cue('_fiddle_flourish')
def _(): return inst(FIDDLE, [(0, .07, 74, 80), (.07, .07, 76, 80), (.14, .3, 79, 90)])
@cue('CARD-011')
def _(): return verb(mix((burst(.25, 600, 6000, .08, 'pink'), 0, .6), (sparkle(8, .3), .05, .6), (shimmer(84, 96, .2, GLOCK, 50, False), .05, .4)), .3, 1.2)
@cue('CARD-012')
def _(): return verb(mix((shatter(.5, 2800, 30), 0, .9), (rev(whoosh(.4, 400, 4000)), .05, .6)), .25, 1.2)
@cue('CARD-013')
def _(): return verb(mix((whoosh(.2, 700, 4000, 1.5, .4), 0, .5), (inst(HARP, [(.05, .4, 79, 85)]), 0, .7), (crystal_ping(mf(91), .3), .05, .3)), .25, 1.0)
@cue('CARD-014')
def _(): return verb(mix((bell(mf(84), .8), 0, .6), (inst(CHOIR, [(0, .5, 72, 40), (0, .5, 76, 40)]), 0, .3)), .3, 1.3)
@cue('CARD-015')
def _(): return mix((paper(.06, 2200), 0, .7), (lp(noise(.1, 'pink'), 1800) * env_exp(N(.1), .03), 0, .4))
@cue('CARD-016')
def _(): return verb(crystal_ping(mf(88), .15), .15, .6) * .6
@cue('CARD-017')
def _(): return verb(mix((thump(260, 120, .1, .02, .5), 0, .8), (wood(700, .12), 0, .7), (crystal_ping(mf(96), .15), .01, .4)), .15, .8)
@cue('CARD-018')
def _(): return mix((paper(.07, 2600), 0, 1), (paper(.05, 2000), .03, .5))
@cue('CARD-019')
def _(): return verb(mix((burst(.5, 1500, 12000, .15), 0, .5), (whoosh(.6, 600, 9000, 1.3, .3, 'white', 0, .2), 0, .6), (inst(CHOIR, [(0, .6, 84, 50)]), 0, .3)), .35, 1.6, 6000)
@cue('CARD-020')
def _(): return mix((rev(whoosh(.3, 600, 4000)), 0, .6), (card_snap(6500), .27, .9))
@cue('CARD-021')
def _(): return mix((whoosh(.1, 1500, 4000), 0, .3), (paper(.06, 2400), .07, 1))
@cue('CARD-022')
def _(): return mix((paper(.03, 4000), 0, .6), (card_slide(.1, 3000), .03, .6))
@cue('CARD-023')
def _(): return mix(*[(snap(4800 + rng.uniform(-500, 500)), i * .03, .5) for i in range(20)], (card_snap(7000), .75, 1))
@cue('CARD-025')
def _(): return verb(mix((sparkle(8, .2), 0, .6), (thump(300, 150, .12, .02, .3), .08, .6), (wood(1200, .08), .08, .5), (inst(CELESTA, [(.06, .4, 84, 70), (.12, .4, 91, 60)]), 0, .5)), .2, 1.0)
@cue('CARD-026')
def _(): return verb(mix((sparkle(6, .2, 2500, 7000), 0, .6), (rev(burst(.2, 2000, 8000, .05)), 0, .3)), .25, 1.0)
@cue('CARD-027')
def _(): return mix((wood(2400, .05), 0, .7), (crystal_ping(mf(96), .15), 0, .4))
@cue('CARD-028')
def _(): return verb(mix((metal(2000, .2, .8), 0, .6), (metal(2600, .15, .8), .06, .5), (shimmer(84, 96, .2, CELESTA, 45), .1, .4)), .2, 1.0)
@cue('CARD-029')
def _(): return verb(mix((whoosh(.5, 300, 4000, 1.2, .5, 'pink', -.7, .7), 0, .6), (shimmer(72, 96, .4, HARP, 60), .1, .5), (snap(7000), .5, .6)), .3, 1.3)
@cue('CARD-030', 'PWB-009')
def _(): return verb(mix((burst(.15, 150, 1200, .05, 'brown'), 0, .6), (wood(300, .2), 0, .6), (inst(TUBULAR, [(.08, 1, 76, 90)]), 0, .6), (crystal_ping(mf(88), .4), .1, .4)), .3, 1.4)
@cue('CARD-031')
def _(): return mix((snap(6500), 0, .8), (inst(HARP, [(.05, .5, 74, 70), (.12, .6, 81, 60)]), 0, .6))

# ---------------------------------------------------------------------------- combat
@cue('CMB-001')
def _(): return mix((creak(.25, 220), 0, .4), (whoosh(.3, 300, 2500, 1.5, .8), 0, .5), (metal(3000, .05, .4), .05, .2))
@cue('CMB-002')
def _(): return verb(mix((whoosh(.5, 200, 2200, 1.2, .5, 'pink', -.4, .4), 0, .7), (mix(*[(metal(rng.uniform(2500, 5000), .06, .5), i * .07, .25) for i in range(6)]), .05, 1),
                         (mix(*[(thump(80, 40, .15, .02, .05), i * .09, .5) for i in range(5)]), .05, .7)), .2, 1.2)
@cue('CMB-003', 'PWB-012')
def _(): return verb(mix((thump(160, 70, .2, .03, .5), 0, 1), (wood(330, .2), 0, .8), (metal(1400, .2, .4), 0, .2)), .15, .9)
@cue('CMB-004')
def _():
    hit = mix((metal(1050, .5, .9), 0, .7), (thump(150, 45, .3, .03, .8), 0, 1), (burst(.08, 300, 6000, .02), 0, .8))
    g = np.ones(len(hit)); a, b = N(.03), N(.1); g[a:b] = .15; g = np.convolve(g, np.ones(N(.004)) / N(.004), 'same')
    hit = hit * g[:, None]  # the hit-stop beat, then the ring-out
    return verb(hit, .15, 1.0)
@cue('CMB-005')
def _(): return verb(mix((thump(100, 34, .45, .05, .5), 0, 1), (lp(burst(.25, 100, 1500, .08, 'pink'), 1200), 0, .7), (lp(noise(.4, 'brown'), 120) * env_ar(N(.4), .1, .9), 0, .5)), .15, 1.1, 2000)
@cue('CMB-006')
def _(): return wood(800, .08)
@cue('CMB-007')
def _(): return verb(mix((gliss(HARP, 67, 91, .3, 70, (0, 2, 4, 7, 9)), 0, .8), (shimmer(88, 100, .3, CELESTA, 45), .1, .4), (inst(CHOIR, [(0, .6, 72, 40), (0, .6, 79, 40)]), 0, .3)), .3, 1.4)
@cue('CMB-008')
def _(): return mix((rev(whoosh(.3, 600, 3500, 1.3, .5, 'pink', .6, -.2)), 0, .6), (CUES['CMB-007'](), .2, 1))
@cue('CMB-009')
def _(): return verb(mix((shatter(.5, 1800, 22), 0, .8), (thump(120, 50, .2, .03, .3), 0, .5), (whoosh(.7, 2500, 500, 1.5, .3, 'pink', 0, .5), .15, .5), (inst(OOHS, [(.15, .7, 64, 40)]), 0, .25)), .3, 1.6)
@cue('CMB-010')
def _(): return mix((lp(noise(.5, 'brown'), 90) * env_ar(N(.5), .05, .95), 0, 1), (creak(.35, 90), .05, .3), (thump(60, 30, .4, .1, .1), 0, .7))
@cue('CMB-011')
def _(): return verb(mix((whoosh(.12, 2000, 9000, 2, .6, 'white'), 0, .5), (metal(4200, .25, .6), .06, .6)), .15, .9)
@cue('CMB-012')
def _(): return mix(*[(lp(burst(.18, 100, 1200, .07, 'pink'), 1500), i * .16, .9) for i in range(2)], (whoosh(.4, 200, 1500), 0, .4))
@cue('CMB-013')
def _(): return mix((thump(80, 32, .4, .06, .3), 0, 1), (thump(70, 30, .35, .06, .2), .14, .8), (lp(noise(.4, 'brown'), 150) * env_ar(N(.4), .05, .95), 0, .6))
@cue('CMB-014')
def _(): return verb(mix((CUES['CMB-004'](), 0, .7), (hp(noise(.35), 3000) * env_ar(N(.35), .05, .95), .05, .3), (drip(1200, 500, .1), .25, .5)), .2, 1.0)
@cue('CMB-015')
def _(): return mix((crackle(.15, 200, 3000, 10000, 0), 0, .6), (mix(*[(wood(900 + 200 * i, .05), i * .06, .5) for i in range(4)]), .05, 1))
@cue('CMB-016', 'PWB-013')
def _(): return verb(mix((metal(2200, .6, .8), 0, .6), (coin(5200), 0, .4), (shimmer(84, 96, .2, CELESTA, 45), .05, .3)), .25, 1.0)
@cue('CMB-017')
def _(): return mix((lp(thump(150, 70, .15, .02, .1), 800), 0, .8), (lp(burst(.1, 100, 1000, .04, 'pink'), 1000), 0, .5), (shimmer(84, 96, .15, CELESTA, 40), .05, .3))
@cue('CMB-018')
def _(): return verb(mix((whoosh(.3, 250, 3000, 1.1, .6, 'pink'), 0, .6), (crackle(.5, 160, 1500, 9000, .5), .15, .8), (thump(120, 45, .3, .04, .4), .2, .8)), .2, 1.1)
@cue('CMB-019')
def _(): return heartbeat(58, 2)
@cue('CMB-020')
def _(): return verb(mix((thump(90, 28, .9, .1, .6), 0, 1), (metal(500, 1.2, .6), 0, .5), (gong(73, 5), .1, .9)), .4, 2.6, 1800)
@cue('CMB-021')
def _(): return verb(mix((drip(900, 380, .15), 0, .7), (drip(700, 300, .15), .14, .5), (whisper(.5), .05, .4)), .35, 1.4, 2000)

# ---------------------------------------------------------------------------- Planeswalk
@cue('PW-002')
def _(): return verb(mix((whoosh(.6, 300, 4000, 1.2, .4), 0, .5), (chord(CHOIR, [64, 67, 71], .1, .8, 55), 0, .4), (metal(2600, .7, .5), .05, .3)), .3, 1.5)
@cue('PW-003')
def _(): return verb(mix((thump(60, 28, 1.2, .2, .1), 0, 1), (whoosh(2.0, 120, 3000, 1, .6, 'pink', -.7, .7), 0, .6),
                         (inst(FIDDLE, [(.6, .2, 62, 90), (.8, .2, 66, 90), (1.0, .2, 69, 95), (1.2, 1.0, 74, 100)]), 0, .7),
                         (inst(WHISTLE, [(.9, .2, 74, 80), (1.1, .2, 78, 80), (1.3, .9, 81, 85)]), 0, .5), (sparkle(10, 1.0), 1.0, .4)), .3, 2.0)
@cue('PW-004')
def _(): return verb(mix((bell(mf(57), 3), 0, .7), (chord(ORGAN, [45, 52, 57, 60, 64], .1, 2.2, 70), 0, .6), (inst(TIMP, [(0, 1, 33, 100)]), 0, .6)), .35, 2.6)
@cue('PW-005')
def _(): return quill(.6)
@cue('PW-006')
def _(): return verb(mix((wood(500, .12), 0, .8), (wood(560, .12), .28, .8), (mix((wood(420, .2), 0, 1), (thump(200, 100, .12, .02, .1), 0, .5)), .6, 1)), .15, .8)
@cue('PW-007')
def _(): return tick(1400, .2)
@cue('PW-008')
def _(): return whoosh(.5, 3000, 300, 1.2, .3, 'pink')
@cue('PW-009')
def _(): return verb(mix((timp_roll(41, .7, 80), 0, .7), (whoosh(.25, 1500, 7000, 2, .8, 'white'), .55, .4), (metal(3400, .4, .6), .75, .4), (inst(FIDDLE, [(.8, .1, 69, 110), (.9, .3, 62, 110)]), 0, .8)), .25, 1.5)
@cue('PW-010')
def _(): return verb(mix((timp_roll(38, .8, 90), 0, .7), (chord(CHOIR, [50, 57, 62, 65], .85, 1.0, 100), 0, .8), (inst(ORCHHIT, [(.85, .5, 50, 100)]), 0, .5), (horn_call([62, 69, 67], 100, HORN, .18, .6), 1.0, .7)), .3, 1.8)
@cue('PW-011')
def _(): return verb(mix((thump(50, 25, 3, .5, .0), 0, .6), (timp_roll(33, 2.4, 90), 0, .7), (chord(BRASS, [38, 45, 50, 53], 1.0, 2.6, 110), 0, .8),
                         (inst(CHOIR, [(1.0, 2.6, p, 95) for p in (50, 57, 62, 65)]), 0, .7), (bell(mf(50), 3), 1.0, .6), (gong(55, 3.5), 2.4, .5)), .35, 2.6)
@cue('PW-012')
def _(): return verb(mix((whisper(1.6), 0, .6), (inst(SLOWSTR, [(0, 2, 38, 80), (0, 2, 45, 60)]), 0, .7)), .4, 2.2, 2000)
@cue('PW-013')
def _(): return verb(mix((thump(140, 60, .3, .04, .6), 0, 1), (lp(burst(.2, 100, 1500, .06, 'pink'), 1500), .02, .5), (chord(SLOWSTR, [38, 45, 48, 53], .05, 1.0, 85), 0, .7), (chord(CHOIR, [50, 53, 57], .05, .9, 60), 0, .4)), .3, 1.6, 2200)
@cue('PW-014')
def _():
    jig = [(0, 74), (.12, 76), (.24, 78), (.36, 79), (.48, 81), (.72, 79), (.84, 78), (.96, 76), (1.08, 74), (1.32, 81), (1.56, 86)]
    return verb(mix((inst(FIDDLE, [(t, .14 if i < 10 else .9, p, 100) for i, (t, p) in enumerate(jig)]), 0, .8),
                    (inst(WHISTLE, [(t, .14 if i < 10 else .9, p + 12, 80) for i, (t, p) in enumerate(jig)]), 0, .4),
                    (lute([50, 57, 62, 66], 0, 80, .02, .7), 0, .5), (lute([55, 62, 67, 71], .72, 80, .02, .6), 0, .5), (lute([50, 57, 62, 66], 1.32, 85, .02, 1.2), 0, .6),
                    (drum([(0, .2, 41, 70), (.48, .2, 41, 60), (.96, .2, 41, 70), (1.32, .4, 41, 90)]), 0, .5)), .25, 1.6)
@cue('PW-015')
def _(): return mix(*[(st(coin() * rng.uniform(.5, 1), rng.uniform(-.5, .5)), .05 + i * .07 + rng.uniform(0, .03), 1) for i in range(11)], (pouch(), .9, 1), (coins(5, .06), .9, .5))
@cue('PW-016')
def _(): return mix((CUES['COL-003'](), 0, 1), (inst(NYLON, [(.05, .5, 74, 75)]), 0, .5))
@cue('PW-017')
def _(): return mix((card_slide(.2, 2600), 0, .8), (pouch(), .18, .8))
@cue('PW-018')
def _(): return lp(card_slide(.18, 2000), 4000) * .7
@cue('PW-019')
def _(): return verb(mix((bell(mf(86), 1.5), 0, .6), (bell(mf(89), 1.3), .09, .4), (lp(noise(1.2, 'pink'), 900) * env_ar(N(1.2), .3, .7), .1, .15)), .3, 1.6)
@cue('PW-020')
def _(): return verb(mix((coins(5, .14), 0, .9), (knock(300), .22, 1), (thump(150, 70, .12, .02, .3), .22, .5)), .15, .9)
@cue('PW-021')
def _(): return mix((lp(coin(3000), 3000), 0, .6), (CUES['APP-012'](), .05, .8))
@cue('PW-022')
def _():
    rip = hp(noise(.3), 1200) * (np.abs(np.sin(np.linspace(0, 70, N(.3)))) ** 6) * env_ar(N(.3), .1, .9)
    return verb(mix((rip, 0, .8), (whoosh(.4, 300, 2500), .25, .4), (crackle(.6, 150, 1200, 8000, .6), .3, .8)), .2, 1.2)
@cue('PW-023')
def _(): return verb(mix((crackle(1.2, 70, 1200, 8000, .8), 0, .6), (thump(90, 50, .2, .03, .1), 0, .4), (gliss(HARP, 62, 86, .8, 70, (0, 2, 4, 7, 9)), .3, .7), (inst(CHOIR, [(.4, 1.0, 74, 40), (.4, 1.0, 78, 40)]), 0, .3)), .3, 1.6)
@cue('PW-024')
def _(): return verb(mix((metal(1600, 1.0, .9), 0, .8), (glass(3100, 1.0), 0, .5), (whoosh(.7, 2500, 9000, 2, .5, 'white', -.8, .8), .2, .4), (shimmer(84, 108, .6, CELESTA, 55), .25, .6)), .3, 1.5)
@cue('PW-025')
def _(): return verb(mix((creak(.6, 150), 0, .6), (metal(1800, .15, .6), .55, .5), (inst(CHOIR, [(.65, 1.3, p, 70) for p in (64, 67, 72)]), 0, .7), (gliss(CELESTA, 72, 100, .6, 60), .7, .6)), .35, 1.8)
@cue('PW-026')
def _(): return verb(mix((thump(140, 70, .2, .03, .4), 0, .7), (wood(260, .2), 0, .5), (inst(TUBULAR, [(.04, 1.6, 64, 95)]), 0, .7), (magic_bloom(76), .08, .6)), .35, 1.7)
@cue('PW-027')
def _(): return verb(mix((cloth(.3), 0, .6), (inst(HARP, [(.25, .3, 69, 80), (.45, .3, 72, 80), (.65, .8, 76, 85)]), 0, .7)), .3, 1.4)
@cue('PW-028')
def _(): return verb(two_note(72, 79, HARP, .16, 85, .6), .25, 1.2)
@cue('PW-029')
def _():
    m = [(0, .3, 74), (.3, .3, 78), (.6, .3, 81), (.9, .9, 86), (1.8, .3, 83), (2.1, .3, 81), (2.4, .3, 78), (2.7, 1.2, 81), (3.9, 1.6, 86)]
    return verb(mix((inst(FIDDLE, [(t, d, p, 105) for t, d, p in m]), 0, .8), (inst(WHISTLE, [(t, d, p, 85) for t, d, p in m]), 0, .45),
                    (inst(STRINGS, [(0, 1.8, 50, 80), (0, 1.8, 57, 80), (1.8, 2.1, 55, 80), (1.8, 2.1, 59, 80), (3.9, 2, 50, 90), (3.9, 2, 57, 90), (3.9, 2, 62, 90)]), 0, .6),
                    (inst(CHOIR, [(3.9, 2, p, 85) for p in (62, 66, 69, 74)]), 0, .6), (drum([(0, .3, 41, 90), (.9, .3, 41, 80), (1.8, .3, 41, 90), (2.7, .3, 41, 80), (3.9, 1.5, 49, 100)]), 0, .6),
                    (inst(TIMP, [(3.9, 1.5, 38, 110)]), 0, .6)), .3, 2.2)
@cue('PW-030')
def _():
    m = [(0, .4, 74), (.4, .4, 77), (.8, .4, 81), (1.2, 1.2, 86), (2.4, .4, 84), (2.8, .4, 81), (3.2, .4, 79), (3.6, 1.2, 81), (4.8, .4, 79), (5.2, .4, 81), (5.6, .4, 84), (6.0, 3.0, 86)]
    return verb(mix((inst(BRASS, [(t, d, p - 12, 100) for t, d, p in m]), 0, .7), (inst(FIDDLE, [(t, d, p, 100) for t, d, p in m]), 0, .6),
                    (inst(CHOIR, [(0, 2.4, 62, 80), (0, 2.4, 69, 80), (2.4, 2.4, 60, 80), (2.4, 2.4, 67, 80), (4.8, 1.2, 64, 85), (4.8, 1.2, 67, 85), (6.0, 3.5, 62, 95), (6.0, 3.5, 66, 95), (6.0, 3.5, 69, 95)]), 0, .7),
                    (inst(TUBULAR, [(t, 2.5, p, 90) for t, p in ((0, 74), (2.4, 72), (4.8, 76), (6.0, 74), (6.0, 81))]), 0, .5),
                    (inst(TIMP, [(0, .5, 38, 100), (2.4, .5, 36, 100), (4.8, .5, 40, 100), (6.0, 2, 38, 120)]), 0, .6), (drum([(6.0, 2.5, 49, 110)]), 0, .5)), .35, 2.6)
@cue('PW-031')
def _():
    m = [(0, .8, 74), (.8, .5, 72), (1.4, 1.2, 69), (2.8, .5, 67), (3.4, .5, 65), (4.0, 2.0, 62)]
    return verb(mix((inst(WHISTLE, [(t, d, p, 70) for t, d, p in m]), 0, .7), (inst(SLOWSTR, [(0, 6, 38, 55), (0, 6, 45, 50)]), 0, .5), (lp(noise(6, 'pink'), 600) * env_ar(N(6), .5, .5), 0, .15)), .4, 2.6)
@cue('PW-032')
def _(): return mix((quill(.12), 0, .6), (tick(1500), .1, .4))
@cue('PW-033')
def _(): return verb(mix((thump(160, 70, .2, .03, .4), 0, 1), (paper(.08, 2200), 0, .7), (burst(.12, 150, 1500, .04, 'pink'), 0, .4)), .15, .9)
# New: the run's items (Token Belt), blessings and seals.
@cue('PW-034')
def _(): return verb(mix((pouch(), 0, .6), (inst(CELESTA, [(.04, .5, 79, 80), (.12, .5, 84, 80), (.2, .8, 88, 85)]), 0, .8), (sparkle(5, .3), .1, .4)), .3, 1.3)
@cue('PW-035')
def _(): return verb(mix((whoosh(.25, 500, 5000, 1.5, .3), 0, .5), (metal(2800, .15, .6), 0, .4), (burst(.3, 800, 8000, .1, 'pink'), .08, .5), (shimmer(79, 96, .3, GLOCK, 55), .1, .5)), .3, 1.3)
@cue('PW-036')
def _(): return verb(mix((thump(180, 70, .2, .03, .8), 0, .8), (shatter(.35, 2000, 14), 0, .5), (lp(burst(.3, 100, 1200, .1, 'pink'), 1200), .05, .4), (whoosh(.6, 300, 3000, 1, .3, 'pink', -.4, .4), .1, .5), (inst(SLOWSTR, [(.15, .9, 50, 70), (.15, .9, 57, 60)]), 0, .4)), .35, 1.7)
@cue('PW-037')
def _(): return verb(mix((inst(CHOIR, [(0, 1.4, p, 75) for p in (60, 64, 67, 72)]), 0, .7), (gliss(HARP, 60, 91, .6, 70, (0, 2, 4, 7, 9)), 0, .6), (bell(mf(84), 1.5), .4, .4), (sparkle(8, .6), .3, .4)), .35, 2.0)
@cue('PW-038')
def _(): return mix((coins(3, .08), 0, .8), (pouch(), .12, .4))

# ---------------------------------------------------------------------------- Planeswalk battle
@cue('PWB-001')
def _(): return verb(mix((crystal_ping(mf(84), .5), 0, .6), (crystal_ping(mf(88), .5), .12, .6), (crystal_ping(mf(91), .6), .24, .7), (whoosh(.4, 500, 3000, 1.2, .5), .1, .3)), .3, 1.2)
@cue('PWB-002')
def _(): return mix(*[(snap(6000 + i * 250), i * .045, .55) for i in range(6)], (whoosh(.25, 800, 3500), 0, .3))
@cue('PWB-003')
def _(): return verb(mix((glass(2900, .25), 0, .6), (glass(3300, .2), .05, .4), (cast_whoosh(.35, 4000), .06, .6), (shimmer(79, 91, .2, CELESTA, 50), .12, .4)), .25, 1.1)
@cue('PWB-004')
def _(): return mix((lp(glass(900, .15), 2500), 0, .6), (wood(400, .1), 0, .4), (CUES['APP-012'](), .05, .6))
@cue('PWB-007')
def _(): return mix(*[(st(glass(rng.uniform(3000, 6000), .04) * .3, rng.uniform(-.3, .3)), i * .018, 1) for i in range(20)])
@cue('PWB-008')
def _(): return verb(mix((wood(1200, .07), 0, .8), (crystal_ping(mf(96), .15), 0, .25)), .1, .6)
@cue('PWB-010')
def _(): return mix((paper(.04, 3500), 0, .6), (inst(PIZZ, [(.02, .2, 69, 70)]), 0, .6))
@cue('PWB-011')
def _(): return lp(thump(110, 55, .15, .02, .2), 1200)
@cue('PWB-014')
def _(): return verb(mix((metal(1700, .3, .9), 0, .6), (metal(2300, .25, .9), .03, .5), (metal(1300, .3, .9), .07, .5), (burst(.1, 1000, 8000, .03), 0, .6), (thump(180, 80, .12, .02, .3), 0, .5)), .2, 1.0)
@cue('PWB-015')
def _(): return verb(mix((thump(90, 35, .4, .05, .3), 0, 1), (whisper(.4, 1200, 5000), .05, .4), (chord(SLOWSTR, [38, 41, 45], .05, .7, 85), 0, .6)), .35, 1.6, 2000)
@cue('PWB-016')
def _(): return mix((card_slide(.25, 2500), 0, .6), (mix(*[(snap(5000 + rng.uniform(-500, 500)), i * .022, .5) for i in range(14)]), .2, 1))
@cue('PWB-017')
def _(): return mix((knock(340), 0, 1), (thump(200, 90, .1, .02, .3), 0, .4), (whoosh(.25, 500, 3500, 1.2, .3), .03, .4))
@cue('PWB-018')
def _(): return mix((CUES['CMB-009'](), 0, 1), (coins(6, .25, None, .6), .2, .6))
@cue('PWB-019')
def _(): return verb(mix((bell(mf(45), 3.5), 0, .8), (chord(CHOIR, [45, 52, 57, 60, 64], .1, 1.8, 95), 0, .7), (timp_roll(33, .8, 90), 0, .5)), .4, 2.4)
@cue('PWB-020')
def _(): return verb(inst(HARP, [(0, .6, 79, 70)]), .3, 1.2)

# ---------------------------------------------------------------------------- Ravnica dungeons
@cue('RAV-001')
def _(): return verb(mix((thump(70, 30, .8, .15, .2), 0, 1), (creak(.7, 100), .1, .5), (metal(400, .9, .5), .4, .5), (chord(BRASS, [40, 47, 52], .4, 1.1, 90), 0, .5)), .35, 2.0)
@cue('RAV-002')
def _(): return verb(mix((metal(900, .4, .8), 0, .7), (wood(250, .2), 0, .6), (metal(1300, .3, .6), .12, .6), (thump(120, 50, .2, .03, .3), .12, .5)), .25, 1.4)
@cue('RAV-003')
def _(): return verb(mix((creak(.5, 140), 0, .4), (inst(CHOIR, [(.3, 1.2, p, 80) for p in (62, 66, 69, 74)]), 0, .6), (gliss(CELESTA, 74, 103, .6, 60), .35, .5), (coins(5, .3), .4, .3)), .35, 1.8)
@cue('RAV-004')
def _(): return verb(mix((thump(110, 50, .3, .04, .3), 0, .7), (bell(mf(62), 1.5), .02, .5), (whoosh(.4, 400, 2500), 0, .3)), .3, 1.6)
@cue('RAV-005')
def _(): return verb(mix((shatter(.5, 1500, 24), 0, .9), (thump(90, 35, .4, .05, .4), 0, .6), (crackle(.6, 120, 1200, 7000, .5), .2, .5)), .3, 1.4)
@cue('RAV-006')
def _(): return verb(mix((inst(TUBULAR, [(0, 2, 74, 100)]), 0, .6), (chord(CHOIR, [62, 69, 74, 78], .1, 1.4, 85), 0, .6), (sparkle(10, .8), .1, .5), (whoosh(.8, 300, 6000, 1.2, .3), 0, .3)), .35, 2.0)

# Cues the main app plays: kept well under the game's effects.
# ---------------------------------------------------------------------------- pack tiers (4.3.49)
# One rising ladder in D major: every price tier answers the flip with its own jingle, each a step grander than the
# last (green a two-note ding, orange a full little fanfare). Warm and round, never brassy or loud.
def flip(): return CUES['PACK-006']()
@cue('PACK-014')
def _():
    # Green: a bright two-note ding.
    return verb(mix((flip(), 0, .9), (inst(CELESTA, [(.05, .35, 81, 64), (.14, .6, 88, 66)]), 0, .75), (glass(mf(100), .3), .14, .08)), .25, 1.0, 6500)
@cue('PACK-015')
def _():
    # Blue: a quick vibraphone arpeggio up a major chord with a glassy shimmer.
    return verb(mix((flip(), 0, .9), (inst(VIBES, [(.05 + i * .07, .7, p, 66) for i, p in enumerate((74, 78, 81, 86))]), 0, .7),
                    (inst(CELESTA, [(.26, .7, 90, 52)]), 0, .35), (sparkle(4, .35, 4000, 8000), .2, .18)), .3, 1.3, 6000)
@cue('PACK-016')
def _():
    # Purple: a shimmer climbs into four celesta notes over a soft choir.
    return verb(mix((flip(), 0, .9), (shimmer(81, 93, .22, GLOCK, 46), .03, .35),
                    (inst(CELESTA, [(.2 + i * .09, .8, p, 66) for i, p in enumerate((81, 86, 90, 93))]), 0, .7),
                    (inst(CHOIR, [(.2, 1.1, p, 40) for p in (62, 69, 74)]), 0, .38), (sparkle(6, .6, 3500, 8500), .3, .2)), .35, 1.6, 5500)
@cue('PACK-017')
def _():
    # Gold: a harp sweep blooms into strings and choir, a glockenspiel cascade on top.
    return verb(mix((flip(), 0, .85), (gliss(HARP, 62, 93, .5, 62, (0, 2, 4, 7, 9)), .04, .6),
                    (inst(SLOWSTR, [(.45, 1.6, p, 54) for p in (50, 57, 62, 66)]), 0, .5), (inst(CHOIR, [(.45, 1.5, p, 44) for p in (66, 69, 74)]), 0, .42),
                    (inst(GLOCK, [(.48 + i * .08, .6, p, 54) for i, p in enumerate((93, 90, 86, 81, 86, 90))]), 0, .32),
                    (sparkle(9, 1.0, 3500, 9000), .5, .22)), .4, 2.0, 5000)
@cue('PACK-018')
def _():
    # Orange (grail): a soft timpani swell lands on a warm horn and string chord, harp and choir rise, bells ring out.
    return verb(mix((flip(), 0, .8), (inst(TIMP, [(.0, .3, 38, 60), (.12, 1.6, 38, 88)]), 0, .45),
                    (gliss(HARP, 57, 98, .55, 64, (0, 2, 4, 7, 9)), .1, .55),
                    (inst(HORN, [(.12, 1.2, p, 58) for p in (62, 66, 69)] + [(1.0, 1.4, p, 62) for p in (64, 69, 73)]), 0, .4),
                    (inst(SLOWSTR, [(.12, 2.2, p, 56) for p in (50, 57, 62, 66, 74)]), 0, .5),
                    (inst(CHOIR, [(.2, 2.0, p, 46) for p in (66, 69, 74, 78)]), 0, .45),
                    (inst(TUBULAR, [(.12, 1.8, 74, 52), (.6, 1.6, 81, 48)]), 0, .22),
                    (inst(GLOCK, [(.7 + i * .07, .6, p, 54) for i, p in enumerate((98, 93, 90, 86, 81, 86, 90, 93, 98))]), 0, .28),
                    (sparkle(14, 1.8, 3500, 9500), .5, .25)), .45, 2.4, 4800)
@cue('PACK-019')
def _():
    # A hit leaves the pack: a low soft rumble with a faint lift, felt more than heard.
    n = N(.55); t = np.arange(n) / SR
    rum = mono(lp(noise(.55, 'pink'), 160)) * (0.55 + 0.45 * np.sin(2 * np.pi * 26 * t)) * env_ar(n, .12, .8)
    return verb(mix((st(rum * 2.2), 0, .9), (thump(95, 45, .4, .1, .05), .02, .6), (whoosh(.4, 300, 1800, 1.4, .5), .05, .25),
                    (inst(CELESTA, [(.32, .4, 86, 34)]), 0, .12)), .25, 1.2, 2500)
@cue('PACK-020')
def _():
    # A big pull gathers itself before it turns: a rising shimmer over a soft swell.
    return verb(mix((cym_swell(.7), 0, .35), (shimmer(74, 98, .65, CELESTA, 44), 0, .45), (inst(SLOWSTR, [(0, .75, 62, 40), (0, .75, 69, 36)]), 0, .35)), .35, 1.4, 5000)

QUIET = {'PACK-003': -8, 'PACK-004': -6, 'PACK-005': -8, 'PACK-006': -6, 'PACK-007': -6, 'PACK-008': -5, 'PACK-009': -4, 'PACK-011': -8, 'COL-005': -5, 'PACK-014': -6, 'PACK-015': -6, 'PACK-016': -5, 'PACK-017': -4, 'PACK-018': -3, 'PACK-019': -6, 'PACK-020': -9}
# Lengths for cues the brief does not list (seconds).
LENGTH = {'PACK-014': .8, 'PACK-015': 1.1, 'PACK-016': 1.6, 'PACK-017': 2.3, 'PACK-018': 3.0, 'PACK-019': .7, 'PACK-020': .8}
PUBLIC = sorted(k for k in CUES if not k.startswith('_'))
