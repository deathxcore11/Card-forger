"""Daily public market ingestion. No inventory or account access, no stored secrets.
MTGJSON is streamed once per run only when new Magic printings need backfill.
"""
import datetime,gzip,json,os,time,urllib.request,urllib.parse
import ijson
BASE='https://noxfmbwuytnbvfgukpiv.supabase.co'
KEY='sb_publishable_TpEfTlAdziX6ALSZLA7U_A_tBKKHcAz'
from functools import lru_cache

UA='CardStashy/3.35.1 (daily dated market observations; github.com/deathxcore11/Card-forger)'
TODAY=datetime.datetime.now(datetime.timezone.utc).date().isoformat()

def get(url,headers=None):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json',**(headers or {})})
    return json.load(urllib.request.urlopen(req,timeout=60))

def table(name,query):
    rows=[]
    for offset in range(0,1000000,1000):
        batch=get(BASE+'/rest/v1/'+name+'?'+query.replace('&limit=3000','')+'&limit=1000&offset='+str(offset),{'apikey':KEY})
        rows+=batch
        if len(batch)<1000:break
    return rows

@lru_cache(maxsize=4096)
def feed(url):
    return get(url)

def current(w):
    g,id,f=w['game'],w['card_id'],w['finish']
    if g=='mtg':
        c=get('https://api.scryfall.com/cards/'+id)
        assert c['id']==id
        value=c.get('prices',{}).get('usd' if f=='nonfoil' else 'usd_'+f)
        source='TCGplayer retail via Scryfall'
    elif g=='ptcg':
        c=get('https://api.tcgdex.net/v2/en/cards/'+id)
        assert c['id']==id
        pricing=c.get('pricing',{}).get('tcgplayer',{})
        q=pricing.get(f)
        if f=='reference':
            q=pricing.get('normal') or next((v for v in pricing.values() if isinstance(v,dict) and v.get('marketPrice') is not None),None)
        elif f.startswith('detail:'):
            d=next((v for v in c.get('variants_detailed',[]) if 'detail:'+str(v.get('variantId'))==f),{})
            candidates=list(d.get('pricing',{}).get('tcgplayer',{}).values())
            q=candidates[0] if len(candidates)==1 else None
        value=(q or {}).get('marketPrice')
        source='TCGplayer market via TCGdex'
        if value is None:
            norm=lambda text: ''.join(x for x in str(text).lower() if x.isalnum())
            groups=feed('https://tcgcsv.com/tcgplayer/3/groups').get('results',[])
            group=next((g for g in groups if norm(g['name'])==norm(c.get('set',{}).get('name'))),None)
            variant=next((v for v in c.get('variants_detailed',[]) if f=='reference' or 'detail:'+str(v.get('variantId'))==f),None)
            if group and variant and variant.get('thirdParty',{}).get('tcgplayer'):
                subtype={'holo':'Holofoil','normal':'Normal','reverse':'Reverse Holofoil'}.get(variant.get('type'))
                quotes=feed('https://tcgcsv.com/tcgplayer/3/'+str(group['groupId'])+'/prices').get('results',[])
                matches=[r for r in quotes if r['productId']==variant['thirdParty']['tcgplayer'] and r['subTypeName']==subtype]
                if len(matches)==1:value=matches[0].get('marketPrice');source='TCGplayer market via TCGCSV'
    else:
        c=get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+id)['data'][0]
        assert str(c['id'])==id and f=='reference'
        value=c.get('card_prices',[{}])[0].get('tcgplayer_price')
        source='TCGplayer reference via YGOPRODeck'
    if value is None or float(value)<=0:return None
    return {**{k:w[k] for k in ['game','card_id','finish']},'source':source,'points':[{'date':TODAY,'value':float(value)}]}

def backfill(watches):
    mapping={}
    for code in sorted(set(w['set_code'] for w in watches if w.get('set_code'))):
        time.sleep(.15)
        try:
            data=get('https://mtgjson.com/api/v5/'+urllib.parse.quote(code.upper(),safe='')+'.json')['data']
            wanted={w['card_id']:w for w in watches if w.get('set_code')==code}
            for c in data.get('cards',[]):
                sid=c.get('identifiers',{}).get('scryfallId')
                if sid in wanted:
                    mapping[c['uuid']]=[w for w in watches if w['card_id']==sid]
        except Exception as e:print('Backfill set unavailable:',code,type(e).__name__)
    if not mapping:return []
    out=[]
    req=urllib.request.Request('https://mtgjson.com/api/v5/AllPrices.json.gz',headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=120) as response, gzip.GzipFile(fileobj=response) as stream:
        for uuid,prices in ijson.kvitems(stream,'data',use_float=True):
            if uuid not in mapping:continue
            retail=prices.get('paper',{}).get('tcgplayer',{}).get('retail',{})
            for w in mapping[uuid]:
                points=retail.get({'nonfoil':'normal','foil':'foil','etched':'etched'}.get(w['finish'],''),{})
                points=[{'date':day,'value':float(v)} for day,v in sorted(points.items()) if isinstance(v,(int,float)) and v>0 and day<=TODAY]
                if points:out.append({'game':'mtg','card_id':w['card_id'],'finish':w['finish'],'source':'TCGplayer retail via MTGJSON','points':points[-366:]})
    return out

def backfill_magic_catalogue():
    """Every priced paper printing: exact MTGJSON UUID -> Scryfall ID, last 31 calendar days."""
    mapping={}
    req=urllib.request.Request('https://mtgjson.com/api/v5/AllIdentifiers.json.gz',headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=120) as response,gzip.GzipFile(fileobj=response) as stream:
        for uuid,card in ijson.kvitems(stream,'data',use_float=True):
            sid=card.get('identifiers',{}).get('scryfallId')
            if sid:mapping[uuid]=sid
    print('Exact Magic printing mappings:',len(mapping),flush=True)
    cutoff=(datetime.date.fromisoformat(TODAY)-datetime.timedelta(days=30)).isoformat()
    batch=[];count=0
    req=urllib.request.Request('https://mtgjson.com/api/v5/AllPrices.json.gz',headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=120) as response,gzip.GzipFile(fileobj=response) as stream:
        for uuid,prices in ijson.kvitems(stream,'data',use_float=True):
            sid=mapping.get(uuid)
            if not sid:continue
            retail=prices.get('paper',{}).get('tcgplayer',{}).get('retail',{})
            for finish,sub in [('nonfoil','normal'),('foil','foil'),('etched','etched')]:
                points=[{'date':day,'value':float(v)} for day,v in sorted(retail.get(sub,{}).items()) if cutoff<=day<=TODAY and isinstance(v,(int,float)) and 0<v<=10000000]
                if not points:continue
                batch.append({'game':'mtg','card_id':sid,'finish':finish,'source':'TCGplayer retail via MTGJSON','points':points})
                if len(batch)>=100:
                    save_rows(batch);count+=len(batch);batch=[]
                    if count%1000==0:print('Magic month histories saved:',count,flush=True)
    if batch:save_rows(batch);count+=len(batch)
    print('Complete Magic month import:',count,flush=True)

def main():
    cutoff=(datetime.date.fromisoformat(TODAY)-datetime.timedelta(days=90)).isoformat()
    if os.getenv('HISTORY_MAGIC_ALL')=='1' and os.getenv('HISTORY_GAME')=='mtg':
        priority=table('market_watch',"select=*&game=eq.mtg&limit=3000")
        save_rows(backfill(priority))
        backfill_magic_catalogue()
    watches=table('market_watch','select=*&touched_at=gte.'+cutoff+'&order=touched_at.desc&limit=3000')
    game=os.getenv('HISTORY_GAME')
    if game:watches=[w for w in watches if w['game']==game]
    print('Public printing/finish series:',len(watches))
    if os.getenv('HISTORY_CATALOGUE'):
        from market_catalogue import catalog_rows
        count=0
        batch=[]
        for row in catalog_rows(game):
            batch.append(row)
            if len(batch)>=25:
                save_rows(batch);count+=len(batch);batch=[]
        if batch:save_rows(batch);count+=len(batch)
        print('Catalogue series saved:',game,count)
    rows=[];failed=0
    for w in watches:
        try:
            r=current(w)
            if r:rows.append(r)
        except Exception as e:failed+=1;print('Quote unavailable:',w['game'],w['card_id'],type(e).__name__)
        time.sleep(.15)
    existing=table('market_series','select=card_id,finish&source=eq.'+urllib.parse.quote('TCGplayer retail via MTGJSON',safe='')+'&limit=3000')
    present={(s['card_id'],s['finish']) for s in existing}
    new=[w for w in watches if w['game']=='mtg' and (w['card_id'],w['finish']) not in present]
    if new:rows+=backfill(new)
    if os.getenv('HISTORY_DRY_RUN'):
        with open(os.getenv('HISTORY_OUTPUT','/tmp/cardstashy-history.json'),'w') as f:json.dump(rows,f)
        print('Verified rows written:',len(rows));return
    save_rows(rows)
    if watches and failed==len(watches):raise RuntimeError('All providers unavailable; previous history preserved')

_token=None
_token_at=0
def save_rows(rows):
    global _token,_token_at
    if not rows:return
    if os.getenv('HISTORY_DRY_RUN'):return
    if not _token or time.monotonic()-_token_at>240:
        _token=get(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience=cardstashy-market-history',{'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})['value'];_token_at=time.monotonic()
    token=_token
    for start in range(0,len(rows),100):
        data=json.dumps(rows[start:start+100]).encode()
        req=urllib.request.Request(BASE+'/functions/v1/market-history',data=data,method='POST',headers={'Content-Type':'application/json','Authorization':'Bearer '+token,'User-Agent':UA})
        result=json.load(urllib.request.urlopen(req,timeout=120));print('Saved series:',result['saved'])

if __name__=='__main__':main()
