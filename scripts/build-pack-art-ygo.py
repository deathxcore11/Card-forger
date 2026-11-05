#!/usr/bin/env python3
"""Picks one chase card per Yu-Gi-Oh! booster set for the pack template (YGOPRODeck). A famous monster (Blue-Eyes, Dark Magician, ...)
if the set has one, else the highest print rarity in that set. Art = https://images.ygoprodeck.com/images/cards_cropped/<id>.jpg. Prints JSON."""
import json,urllib.request,urllib.parse,time,re
H={'User-Agent':'CardStashy pack art picker'}
def get(u):
    for _ in range(3):
        try:return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=40))
        except urllib.error.HTTPError as e:
            if e.code==400:return None
            time.sleep(2)
        except Exception:time.sleep(2)
RAR=[('starlight',12),('ghost',11),('ultimate',10),('prismatic',10),('quarter century',10),('collector',9),('secret',9),('platinum',8),('ultra',7),('super',5),('shatterfoil',5),('rare',2)]
rs=lambda r:next((v for k,v in RAR if k in (r or '').lower()),0)
FAM="Blue-Eyes Dark Magician Red-Eyes Exodia Black Luster Dark Magician Girl Utopia Stardust Number Elemental HERO Cyber Dragon Time Wizard Summoned Skull Slifer Obelisk Winged Dragon Egyptian God Dark Armed Yubel Crystal Beast Blackwing Blue-Eyes Galaxy-Eyes Dragon Ash Nibiru Accesscode Odd-Eyes".split()
fam=lambda n:0 if re.search('Blue-Eyes|Dark Magician|Red-Eyes|Exodia|Galaxy-Eyes|Stardust|Utopia|Black Luster|Obelisk|Slifer|Winged Dragon',n) else 1
sets=get('https://db.ygoprodeck.com/api/v7/cardsets.php')
BAD=re.compile(r'tin|promo|box|collection|starter|structure|deck|pack:|kit|battle|gift|bundle|set\b|special edition|championship|series|prize|sneak|jump|shonen|magazine|dueling|retro',re.I)
sets=[s for s in sets if s.get('num_of_cards',0)>=40 and not BAD.search(s['set_name']) and s.get('tcg_date')]
out={}
for s in sets:
    d=get('https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset='+urllib.parse.quote(s['set_name']));time.sleep(.06)
    if not d or 'data' not in d:continue
    best=None
    for c in d['data']:
        for cs in c.get('card_sets',[]):
            if cs['set_name']==s['set_name']:
                sc=(-fam(c['name']),rs(cs.get('set_rarity')),c.get('atk') or 0 if 'Monster' in c['type'] else -1)
                if best is None or sc>best[0]:best=(sc,c,cs)
    if best:out[s['set_code']]={'name':s['set_name'],'card':best[1]['name'],'id':best[1]['id'],'rarity':best[2].get('set_rarity'),'date':s['tcg_date']}
print(json.dumps(out,indent=1))
