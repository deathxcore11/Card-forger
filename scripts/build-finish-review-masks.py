"""Build deterministic SVG material maps and glyph masks for the review only.

Source card images remain unchanged. Glyph masks are tied to the retained image
bytes in mask-provenance.json and must not be reused with another image revision.
"""
from pathlib import Path
import hashlib, json, random, math
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'review' / 'assets'
def svg(name, body, w=600, h=840):
    (ROOT/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>\n')

provenance=[]
for source, dest in [('hot-red-dragon-abyss.jpg','abyss-title.svg'),('psy-framegear-gamma.jpg','gamma-title.svg'),('psy-framelord-omega.jpg','omega-title.svg')]:
    im=Image.open(ROOT/source).convert('RGB'); w,h=im.size; px=im.load()
    x0,x1,y0,y1=int(w*.071),int(w*.827),int(h*.054),int(h*.103)
    paths=[]
    for y in range(y0,y1):
        start=None
        for x in range(x0,x1+1):
            dark=x<x1 and max(px[x,y])<92
            if dark and start is None:start=x
            if not dark and start is not None:
                paths.append(f'M{start} {y}h{x-start}v1h-{x-start}z');start=None
    svg(dest,'<path fill="white" d="'+''.join(paths)+'"/>',w,h)
    provenance.append({'mask':dest,'sourceImage':source,'sha256':hashlib.sha256((ROOT/source).read_bytes()).hexdigest(),'region':[x0,y0,x1,y1],'method':'dark-title-pixel runs within audited title bounds; no font substitution','status':'review-required'})

svg('base1-4-foil.svg','<rect x="66" y="99" width="472" height="327" fill="white"/>',600,825)
svg('base4-20-foil.svg','<rect x="68" y="98" width="465" height="322" fill="white"/>',600,825)
r=random.Random(3843)
body=[]
for _ in range(72):
    x,y=r.uniform(45,555),r.uniform(80,465);rad=r.uniform(.8,3.2)
    body.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad:.1f}" fill="{r.choice(["#b3e9fa","#e9cff5","#f7e4ab"])}" opacity="{r.uniform(.3,.85):.2f}"/>')
    if rad>2.7:body.append(f'<path d="M{x-5:.1f} {y:.1f}h10 M{x:.1f} {y-5:.1f}v10" stroke="#e1edfa" stroke-width=".6"/>')
svg('cosmos.svg',''.join(body))
body=[]
for y in range(25,830,65):
    for x in range(30,600,65):
        body.append(f'<path d="M{x} {y-12}q-16 19 0 25q16-6 0-25z" fill="none" stroke="#b5dbea" stroke-width="1.2" opacity=".7"/>')
svg('water-pattern.svg',''.join(body))
body=[]
for offset in range(-500,800,5):
    points=[]
    for y in range(0,850,15):
        x=offset+100*math.sin(y/180)+45*math.sin(y/70)
        points.append(f'{x:.1f},{y}')
    body.append('<polyline points="'+' '.join(points)+'" fill="none" stroke="#d5e8ee" stroke-width="1" opacity=".6"/>')
svg('relief-flow.svg',''.join(body))
body=[]
for _ in range(220):
    x,y=r.uniform(15,585),r.uniform(15,825);s=r.uniform(1,3)
    body.append(f'<path d="M{x-s:.1f} {y:.1f}h{s*2:.1f} M{x:.1f} {y-s:.1f}v{s*2:.1f}" stroke="{r.choice(["#e1f6ff","#e7bce6","#f5e4ad"])}" stroke-width=".8"/>')
svg('starlight.svg',''.join(body))
body=[]
for _ in range(7000):
    x,y=r.randrange(600),r.randrange(840)
    body.append(f'<path d="M{x} {y}h1.2" stroke="{r.choice(["#e3ead2","#324039","#aebeb0"])}" stroke-width=".8" opacity=".5"/>')
svg('metal-grain.svg',''.join(body))
(ROOT/'mask-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print('Built registered review maps and three exact-image title glyph masks.')
