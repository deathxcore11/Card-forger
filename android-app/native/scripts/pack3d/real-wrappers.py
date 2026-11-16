# How assets/packs/real/<set>.webp were made (15 Nov 2026, run in a cloud session; paths are that session's scratch folders).
# For each Magic set in pack-wrappers.js: the MTG Wiki's booster photo where WIKI names one, else the worker's TCGplayer photo
# (cardstashy.com/img/pack/mtg.jpg), else (NOREAL) our own drawn wrapper. Background cut away, edges filled, sideways packs turned
# upright, at most 720 px tall. assets/packs/real/sources.json records each set's source, file and original height.
import json,os,urllib.request,urllib.parse
import numpy as np
from PIL import Image,ImageDraw
codes=json.load(open('codes.json'));lst={t:(u,w,h) for t,u,w,h in json.load(open('list.json'))}
WIKI={'4ed':'4ED booster.jpg','6ed':'6ED booster.jpg','apc':'APC booster.jpg','inv':'INV booster 1.jpg','pls':'PLS booster.jpg','uds':'UDS booster.jpg','ulg':'ULG booster.jpg',
'blb':'BLB Play Booster.png','acr':'ACR Beyond Booster.png','cmr':'CMR draft booster.png','ecl':'ECL Play Booster 1.png','eoe':'EOE Play Booster.png','fdn':'FND Play Booster.png','fra':'FRA Play Booster 1.png','hob':'HOB Play Booster 1.png','hou':'HOU booster.png','mh2':'MH2 Booster.png','mkm':'MKM Play Booster.png','msh':'MSH Play Booster 1.png','otj':'OTJ Play Booster.png','sos':'SOS Play Booster 1.png','spm':'SPM Play Booster.png','tla':'TLA Play Booster.png','tmt':'TMT Play Booster 1.png','trk':'TRK Play Booster 1.png','tsr':'TSR Draft Pack.png','uma':'UMA Booster pack.png','unh':'UNH booster.jpg','rin':'RIN Booster.jpg','eld':'ELD booster.png','ema':'EMA booster.png','mir':'MIR booster.jpg','mmq':'MMQ booster.jpg','ice':'ICE booster.jpg','vis':'VIS booster.jpg','tmp':'TMP booster 1.jpeg','hml':'HML booster.jpg','all':'ALL booster.jpg','atq':'Antiquities booster.jpg','arn':'Arabian Nights booster.jpg','lea':'Alpha booster.jpg','2ed':'Unlimited booster.jpg','3ed':'Revised booster.jpg','leg':'Legends booster.jpg','drk':'The Dark booster.jpg','fem':'Fallen Empires booster.jpg','mma':'MM booster.jpg','m11':'Magic2011Booster.jpg','gtc':'GTC Booster 1.jpg','rtr':'RTR Booster 1.jpg',
'bbd':'BBD Booster pack.jpg','cn2':'CN2 Booster pack.png','cns':'CNS Booster pack.jpg','ugl':'UGL Booster pack.jpg','clu':'CLU Ravnica Clue Edition booster.png','mb2':'MB2 Booster.png','mbc':'MBC booster.png'}
NOREAL={'arb','ltr','wwk','som','csp','sum'}
def fetch(t):
    p='wk/'+t.replace(' ','_')
    if not os.path.exists(p):
        open(p,'wb').write(urllib.request.urlopen(urllib.request.Request(lst[t][0],headers={'User-Agent':'Mozilla/5.0 (preview build)'}),timeout=60).read())
    return p
def clean(im):
    im=im.convert('RGBA');a=np.array(im)
    if (a[...,3]<200).mean()>.02: mask=a[...,3]<200   # real transparency
    else:
        # white (or near white) background touching the border
        rgb=Image.fromarray(a[...,:3]).copy();w,h=rgb.size
        M=Image.new('L',(w+2,h+2),0);big=Image.new('RGB',(w+2,h+2),(255,255,255));big.paste(rgb,(1,1))
        ImageDraw.floodfill(big,(0,0),(255,0,255),thresh=28)
        b=np.array(big)[1:-1,1:-1];mask=(b[...,0]==255)&(b[...,1]==0)&(b[...,2]==255)
    ok=~mask
    rows=np.where(ok.mean(1)>.25)[0];cols=np.where(ok.mean(0)>.25)[0]
    if len(rows)<20 or len(cols)<20: return im.convert('RGB'),0
    y0,y1,x0,x1=rows[0],rows[-1]+1,cols[0],cols[-1]+1
    a=a[y0:y1,x0:x1];ok=ok[y0:y1,x0:x1];out=a[...,:3].copy();idx=np.arange(out.shape[1])
    for y in range(out.shape[0]):
        xs=np.where(ok[y])[0]
        if len(xs)==0: continue
        out[y]=a[y,xs[np.abs(idx[:,None]-xs[None,:]).argmin(1)],:3]
    good=np.where(ok.any(1))[0]
    for y in range(out.shape[0]):
        if not ok[y].any(): out[y]=out[good[np.abs(good-y).argmin()]]
    return Image.fromarray(out),float(mask.mean())
man={}
for c,n,p,r in codes:
    src='server';path=f'srv/{c}.jpg'
    if c in NOREAL: src='drawn';path=f'/home/user/card-forger/assets/packs/pack-{c}.webp'
    elif c in WIKI and WIKI[c] in lst: src='wiki';path=fetch(WIKI[c])
    try:
        im,bg=clean(Image.open(path))
    except Exception as e:
        print(c,'FAIL',e);continue
    rot=im.width>im.height*1.1
    if rot: im=im.rotate(90,expand=True)
    native=im.height
    if im.height>720: im=im.resize((round(im.width*720/im.height),720),Image.LANCZOS)
    im.save(f'tex/{c}.webp',quality=82)
    man[c]={'name':n,'product':p,'year':(r or '')[:4],'src':src,'file':WIKI.get(c) if src=='wiki' else None,'w':im.width,'h':im.height,'native':native,'rot':rot,'aspect':round(im.width/im.height,3)}
json.dump(man,open('manifest.json','w'),indent=0)
import collections;print(collections.Counter(m['src'] for m in man.values()),len(man))
print('odd aspect',[(c,m['aspect']) for c,m in man.items() if not .46<m['aspect']<.66])
print('lowres',[c for c,m in man.items() if m['native']<300])
