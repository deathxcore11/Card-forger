#!/usr/bin/env python3
"""Bakes one art crop per Pokémon set (from build-pack-art-ptcg.py's JSON) into assets/packs/art/ptcg-<id>.webp.
Full-art cards (secret/illustration) use almost the whole card; regular cards use their era's art box.
usage: bake-pack-art-ptcg.py picks.json cache_dir"""
import json,sys,os,urllib.request,concurrent.futures as cf
from PIL import Image
P=json.load(open(sys.argv[1]));C=sys.argv[2]
def era(i):
    if i.startswith(('base','gym','neo','si1','lc','np')) or i=='basep':return (.12,.124,.893,.485)
    if i.startswith('ecard'):return (.10,.14,.90,.465)
    if i.startswith(('ex','pop','ru1')):return (.095,.115,.905,.466)
    if i.startswith(('dp','pl','hgss','col')):return (.08,.115,.92,.48)
    if i.startswith(('bw','dv')):return (.07,.11,.93,.49)
    if i.startswith(('xy','dc','g1')):return (.065,.125,.935,.485)
    if i.startswith('det'):return (.065,.125,.935,.47)
    return (.065,.12,.935,.485)
BOX={'gym1':(.125,.13,.88,.475),'gym2':(.125,.135,.875,.47)}  # per-set overrides after eyeballing: id -> (x0,y0,x1,y1)
FULL=(0.0,.145,1.0,.56)  # secret/illustration art runs edge to edge; name bar above and attacks below stay out
MODERN=('sv','me','30th')
def get(a):
    i,v=a;f=f'{C}/{i}.webp'
    if not os.path.exists(f):
        urllib.request.urlretrieve(v['image']+'/high.webp',f)
    return i
with cf.ThreadPoolExecutor(8) as ex:
    for _ in ex.map(get,P.items()):pass
for i,v in P.items():
    im=Image.open(f'{C}/{i}.webp').convert('RGB');w,h=im.size
    b=BOX.get(i) or (FULL if v['beyond'] and i.startswith(MODERN) else era(i))
    c=im.crop((int(b[0]*w),int(b[1]*h),int(b[2]*w),int(b[3]*h)))
    s=520/c.width
    if s<1:c=c.resize((520,round(c.height*s)),Image.LANCZOS)
    c.save(f'assets/packs/art/ptcg-{i}.webp','WEBP',quality=78,method=6)
print(len(P))
