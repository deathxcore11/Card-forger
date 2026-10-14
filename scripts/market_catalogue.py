"""Walk complete provider catalogues; write only real dated quotes, never synthetic history."""
import importlib.util,json,gzip,urllib.request,time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
spec=importlib.util.spec_from_file_location('market_importer',Path(__file__).with_name('market-history.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def row(game,id,finish,source,value):
    try:value=float(value)
    except (ValueError,TypeError):return None
    if not 0<value<=10000000:return None
    return {'game':game,'card_id':str(id),'finish':finish,'source':source,'points':[{'date':m.TODAY,'value':value}]}

def catalog_rows(game):
    if game=='mtg':
        def priced(card):
            if 'paper' not in card.get('games',[]):return
            for finish,key in [('nonfoil','usd'),('foil','usd_foil'),('etched','usd_etched')]:
                r=row(game,card['id'],finish,'TCGplayer retail via Scryfall',card.get('prices',{}).get(key))
                if r:yield r
        try:
            bulk=m.get('https://api.scryfall.com/bulk-data')
            snapshot=next(x for x in bulk['data'] if x['type']=='default_cards')
            url=snapshot.get('download_uri') or snapshot.get('jsonl_download_uri')
            if not url:raise KeyError('bulk download URI')
            request=urllib.request.Request(url,headers={'User-Agent':m.UA,'Accept':'application/json'})
            with urllib.request.urlopen(request,timeout=180) as stream:
                if snapshot.get('jsonl_download_uri') and not snapshot.get('download_uri'):
                    with gzip.GzipFile(fileobj=stream) as records:
                        for line in records:
                            if line.strip():yield from priced(json.loads(line))
                else:
                    for card in m.ijson.items(stream,'item',use_float=True):yield from priced(card)
        except (OSError,KeyError,StopIteration,ValueError) as error:
            print('Bulk snapshot unavailable:',type(error).__name__,'using complete paged printing search')
            url='https://api.scryfall.com/cards/search?q=game%3Apaper&unique=prints&order=set&dir=desc'
            while url:
                data=m.get(url)
                for card in data.get('data',[]):yield from priced(card)
                url=data.get('next_page') if data.get('has_more') else None
                if url:time.sleep(.15)
    elif game=='ygo':
        cards=m.get('https://db.ygoprodeck.com/api/v7/cardinfo.php')['data']
        for card in cards:
            r=row(game,card['id'],'reference','TCGplayer reference via YGOPRODeck',card.get('card_prices',[{}])[0].get('tcgplayer_price'))
            if r:yield r
    elif game=='ptcg':
        cards=m.get('https://api.tcgdex.net/v2/en/cards')
        # Four bounded readers. Complete catalogue rather than watched-card-only tracking.
        def quotes(brief):
            id=brief['id']
            try:
                card=m.get('https://api.tcgdex.net/v2/en/cards/'+m.urllib.parse.quote(id,safe=''))
                if '/tcgp/' in card.get('image','') or card.get('set',{}).get('id','').startswith('P-A') or (card.get('set',{}).get('id','').startswith('A') and card.get('set',{}).get('id','')[1:2].isdigit()):return []
                pricing=card.get('pricing',{}).get('tcgplayer',{});out=[]
                def add(f,q):
                    if isinstance(q,dict):
                        r=row(game,id,f,'TCGplayer market via TCGdex',q.get('marketPrice'))
                        if r:out.append(r)
                reference=pricing.get('normal') or next((q for q in pricing.values() if isinstance(q,dict) and q.get('marketPrice') is not None),None)
                add('reference',reference)
                for f,q in pricing.items():add(f,q)
                for v in card.get('variants_detailed',[]):
                    qs=list(v.get('pricing',{}).get('tcgplayer',{}).values())
                    if len(qs)==1:add('detail:'+str(v['variantId']),qs[0])
                if not out:
                    fallback=m.current({'game':game,'card_id':id,'finish':'reference'})
                    if fallback:out.append(fallback)
                return out
            except Exception as e:print('Catalogue quote unavailable:',game,id,type(e).__name__);return []
            finally:time.sleep(.15)
        with ThreadPoolExecutor(max_workers=4) as readers:
            for results in readers.map(quotes,cards):
                yield from results
    else:raise ValueError('Select mtg, ptcg or ygo')
