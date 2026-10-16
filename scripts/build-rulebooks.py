#!/usr/bin/env python3
"""Build searchable, dated references from the owner-supplied official PDFs. No source PDF is modified."""
import gzip,json,re,subprocess,sys,hashlib
from pathlib import Path
src=Path(sys.argv[1]);dest=Path(__file__).resolve().parents[1]/'rulebooks'
dest.mkdir(exist_ok=True)
docs={
'mtg':[('MagicCompRules 20260925.pdf','Comprehensive Rules','2026-09-25','https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.pdf',False),('EN_MTGM14_PrintedRulebook_LR.pdf','M14 beginner guide','2013','https://magic.wizards.com/en/rules',True)],
'ptcg':[('30c_rulebook_en.pdf','Pokémon rulebook','2026-09','https://play.pokemon.com/en-us/resources/rules/',False),('play-pokemon-tcg-tournament-handbook-en.pdf','Tournament handbook','2026-09-01','https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf',False),('tcg_errata.pdf','Card errata','2026-08-17','https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/tcg_errata.pdf',False),('tcg-alternative-play-handbook-en.pdf','Alternative play','Supplied edition','https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/tcg-alternative-play-handbook-en.pdf',False)],
'ygo':[('SD_RuleBook_EN_10.pdf','Rulebook version 10','Version 10 + later updates','https://www.yugioh-card.com/en/downloads/rulebook/SD_RuleBook_EN_10.pdf',True),('YS17_BG_EN.pdf','Link Strike beginner guide','2017','https://www.yugioh-card.com/en/downloads/rulebook/YS17_BG_EN.pdf',True)]}
manifest={}
for game,books in docs.items():
 entries=[];sources=[]
 for di,(file,title,date,url,legacy) in enumerate(books):
  # Raw reading order keeps the columns of illustrated booklets together.
  text=subprocess.check_output(['pdftotext','-raw',str(src/file),'-'],text=True)
  pages=text.split('\f');sources.append(dict(title=title,date=date,url=url,legacy=legacy,pages=len(pages)-int(not pages[-1].strip())))
  if game=='mtg' and di==0:
   current=None;glossary=False
   for page,content in enumerate(pages,1):
    if page<6:continue
    if re.search(r'^Glossary\s*$',content,re.M):glossary=True
    if glossary:
     if current:entries.append(current);current=None
     if content.strip():entries.append(dict(id=f'glossary-{page}',title=f'Glossary · PDF page {page}',text=content.strip(),page=page,doc=di,chapter='Glossary'))
     continue
    for line in content.splitlines():
     hit=re.match(r'^(\d{3})\.(\d+[a-z]?)?\.?\s+(.+)',line)
     if hit:
      if current:entries.append(current)
      rid=hit[1]+'.'+(hit[2] or '')
      current=dict(id=rid,title=rid+' '+hit[3][:95],text=line,page=page,doc=di,chapter=hit[1][0])
     elif current:current['text']+='\n'+line
   if current:entries.append(current)
  else:
   for page,content in enumerate(pages,1):
    content=content.strip()
    if not content:continue
    # The M14 print PDF contains repeated glyph runs in raw extraction; keep a
    # source link instead of publishing corrupted text as a searchable rule.
    if game=='mtg':continue
    lines=[l.strip() for l in content.splitlines() if l.strip()]
    entries.append(dict(id=f'{di}-p{page}',title=f'{title} · PDF page {page}',text='\n'.join(lines),page=page,doc=di,chapter=title))
 raw=json.dumps(dict(schema=1,game=game,sources=sources,entries=entries),ensure_ascii=False,separators=(',',':')).encode()
 zipped=gzip.compress(raw,mtime=0);file=game+'-rules-v1.json.gz';(dest/file).write_bytes(zipped)
 manifest[game]=dict(file='rulebooks/'+file,bytes=len(zipped),count=len(entries),sha256=hashlib.sha256(raw).hexdigest())
 print(game,len(entries),len(zipped),'bytes')
(dest/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
