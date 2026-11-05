#!/usr/bin/env python3
"""Picks one strong card per baked Magic set for the pack template (pack-art-data.js).
Scryfall search per set, EDHREC rank order (price for sets without ranks), preferring creatures and
planeswalkers among the top 25, and never the same illustration twice (overrides run first). Hand fixes go in OVERRIDES. Writes JSON to stdout; paste into pack-art-data.js."""
import json,urllib.request,urllib.parse,time
OVERRIDES={'tmp':'Dauthi Slayer','ktk':'Siege Rhino','3ed':'Serra Angel','4ed':'Shivan Dragon','5ed':'Mahamoti Djinn'}
H={'User-Agent':'CardStashy/1.0 (pack art picker)','Accept':'application/json'}
def get(u):
    for _ in range(3):
        try:return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30))
        except urllib.error.HTTPError as e:
            if e.code==404:return None
            time.sleep(1)
        except Exception:time.sleep(1)
used=set()
def img(x):return (x.get('image_uris') or x['card_faces'][0]['image_uris'])['art_crop'].split('?')[0]
out={}
codes=sorted(json.load(open('data/mtg-boosters/index.json'))['sets'])
for c in [c for c in codes if c in OVERRIDES]:  # overrides first, so no other set takes their illustration
    d=get('https://api.scryfall.com/cards/search?'+urllib.parse.urlencode({'q':f'e:{c} !"{OVERRIDES[c]}"'}));time.sleep(.11)
    if d and d.get('data'):x=d['data'][0];out[c]={'card':x['name'],'art':img(x)};used.add(x.get('illustration_id'))
for c in codes:
    if c in out:continue
    for q,o in [(f'e:{c} (r:rare OR r:mythic) -t:land -is:variation game:paper','edhrec'),(f'e:{c} (r:rare OR r:mythic) -t:land game:paper','usd'),(f'e:{c} -t:basic game:paper','usd')]:
        d=get('https://api.scryfall.com/cards/search?'+urllib.parse.urlencode({'q':q,'order':o,'dir':'desc' if o=='usd' else 'asc','unique':'cards'}));time.sleep(.11)
        top=[x for x in (d or {}).get('data',[]) if x.get('image_uris') or x.get('card_faces',[{}])[0].get('image_uris')][:25]
        top=[x for x in top if x.get('illustration_id') not in used] or top
        if top:
            s=lambda i:-(('Planeswalker' in top[i]['type_line'] or 'Creature' in top[i]['type_line'])+('Legendary' in top[i]['type_line']))
            x=top[sorted(range(len(top)),key=lambda i:(s(i),i))[0]];out[c]={'card':x['name'],'art':img(x)};used.add(x.get('illustration_id'));break
print(json.dumps(out,indent=1))
