#!/usr/bin/env python3
"""Add real Magic card art for new Planeswalk cards: Scryfall art crop -> 400px webp data URI rule in planeswalk-skin.css,
plus the artist credit in the art credits line. Usage: python3 tools/addart.py "Card Name" ["Other Name" ...]
Skips names that already have a rule. Each card uses its own art (never another card's)."""
import sys,os,io,json,base64,re,time,urllib.request,urllib.parse
from PIL import Image
W=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));P=W+'/planeswalk-skin.css'
css=open(P).read()
def get(u,j=True):
  r=urllib.request.Request(u,headers={'User-Agent':'CardStashy-Planeswalk/1.0','Accept':'application/json' if j else '*/*'})
  with urllib.request.urlopen(r,timeout=30) as f:return json.load(f) if j else f.read()
add=[];cred=[]
for n in sys.argv[1:]:
  n,_,lf=n.partition('=')  # "Shown name=/path/to/our-painting.webp": our own checked painting, no outside credit
  n,_,q=n.partition('|')
  if lf:
    if '[data-n="%s"]{--img:'%n in css:print('have',n);continue
    im=Image.open(lf).convert('RGB');w=400;im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    b=io.BytesIO();im.save(b,'WEBP',quality=78);add.append('[data-n="%s"]{--img:url(data:image/webp;base64,%s)}'%(n,base64.b64encode(b.getvalue()).decode()));print('added',n,'(ours)',len(b.getvalue()),'bytes');continue  # "Shown name|scryfall search" for tokens, e.g. "Angel token|t:token set:tgrn angel"
  if '[data-n="%s"]{--img:'%n in css:print('have',n);continue
  d=get('https://api.scryfall.com/cards/search?q='+urllib.parse.quote(q))['data'][0] if q else get('https://api.scryfall.com/cards/named?exact='+urllib.parse.quote(n));time.sleep(.12)
  iu=d.get('image_uris') or d['card_faces'][0]['image_uris'];artist=d.get('artist') or d['card_faces'][0]['artist']
  im=Image.open(io.BytesIO(get(iu['art_crop'],False))).convert('RGB');w=400;im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
  b=io.BytesIO();im.save(b,'WEBP',quality=78);add.append('[data-n="%s"]{--img:url(data:image/webp;base64,%s)}'%(n,base64.b64encode(b.getvalue()).decode()))
  cred.append('%s by %s'%(d['name']+(' token' if q and 'token' not in d['name'].lower() else ''),artist));print('added',n,'by',artist,len(b.getvalue()),'bytes')
if add:
  m=re.search(r'(\.note:last-child::after\{content:"Art: )([^"]*?)( · Location paintings)',css);assert m
  items=sorted(set(m.group(2).split(' · ')+cred),key=str.lower)
  css=css[:m.start(2)]+' · '.join(items)+css[m.end(2):]
  css+='\n/* card art for new cards (tools/addart.py): Scryfall art crops credited in the art line, or our own checked paintings */\n'+'\n'.join(add)+'\n'
  open(P,'w').write(css)
