#!/usr/bin/env python3
"""Picks one chase card per Pokémon set for the pack template, from tcgdex (the site's own set ids).
Rarity first (illustration / hyper / ultra / holo), then a popular Pokémon from the set. Prints JSON."""
import json,urllib.request,time,sys,re
POP="Charizard Mewtwo Mew Pikachu Lugia Ho-Oh Rayquaza Umbreon Espeon Gengar Gyarados Dragonite Lucario Greninja Garchomp Arceus Giratina Dialga Palkia Blastoise Venusaur Eevee Snorlax Gardevoir Mimikyu Zacian Zamazenta Miraidon Koraidon Lapras Tyranitar Latias Latios Suicune Entei Raikou Celebi Groudon Kyogre Darkrai Reshiram Zekrom Kyurem Sylveon Glaceon Leafeon Flareon Vaporeon Jolteon Alakazam Machamp Ninetales Arcanine Gold Mawile Absol Salamence Metagross Deoxys Jirachi Manaphy Lopunny Togekiss Gholdengo Terapagos Flutter Roaring Iron Walking Gouging Raging".split()
RAR=[('special illustration',10),('hyper',9),('mega hyper',9),('secret',8),('illustration',8),('ultra',7),('vmax',7),('vstar',6),('amazing',6),('radiant',6),('double',6),('holo rare v',6),('ex',6),('gx',6),('lv.x',6),('prime',6),('legend',6),('break',5),('rare holo',4),('holo',3),('rare',1)]
def rs(r):
    r=(r or '').lower()
    for k,v in RAR:
        if k in r:return v
    return 0
def get(u):
    for _ in range(3):
        try:return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'CardStashy pack art picker'}),timeout=30))
        except Exception:time.sleep(1)
def pop(n):
    for i,p in enumerate(POP):
        if p.lower() in n.lower():return i
    return 999
ids=sys.argv[1:]
out={}
for sid in ids:
    s=get('https://api.tcgdex.net/v2/en/sets/'+sid)
    if not s or not s.get('cards'):continue
    cards=s['cards'];off=s['cardCount'].get('official') or len(cards)
    def num(c):
        try:return int(''.join(ch for ch in c['localId'] if ch.isdigit()))
        except:return 0
    beyond=[c for c in cards if num(c)>off]
    cand=sorted(cards,key=lambda c:(pop(c['name']),-num(c)))[:4]+beyond[:3]+sorted(beyond,key=lambda c:pop(c['name']))[:3]+beyond[-4:]+cards[-3:]+sorted(cards,key=lambda c:pop(c['name']))[4:8]
    seen=set();best=None
    for c in cand:
        if c['id'] in seen:continue
        seen.add(c['id']);d=get('https://api.tcgdex.net/v2/en/cards/'+c['id']);time.sleep(.05)
        if not d or not d.get('image') or d.get('category')!='Pokemon' or re.search(r'LEGEND|Tapu Fini',d['name']):continue
        r=rs(d.get('rarity'))
        if sid.startswith(('bw','xy','sm','swsh','dv','g1','dc','det','cel')) and 'secret' in (d.get('rarity') or '').lower():r=5  # rainbow / gold washes look cheap: an Ultra Rare or holo beats them
        sc=(r,-pop(d['name']),num(c)>off)
        if best is None or sc>best[0]:best=(sc,d,c)
    if best:
        d=best[1];out[sid]={'card':d['name'],'rarity':d.get('rarity'),'image':d['image'],'beyond':num(best[2])>off,'set':s['name'],'logo':s.get('logo'),'symbol':s.get('symbol')}
    time.sleep(.05)
print(json.dumps(out,indent=1))
