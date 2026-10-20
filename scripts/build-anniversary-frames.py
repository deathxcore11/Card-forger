import json,pathlib,hashlib,re,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import Polygon,box
from shapely.ops import polylabel
root=pathlib.Path(__file__).resolve().parent.parent;p=root/'tests/fixtures/anniversary-frames'
# Native 734x1024 source: outer white edge of the anniversary mark, including both ears.
stamp=np.array([[547,419],[553,417],[566,421],[582,430],[595,442],[606,456],[614,453],[627,451],[640,452],[650,454],[658,457],[670,440],[683,430],[697,422],[710,417],[718,417],[719,421],[714,439],[706,452],[694,464],[677,476],[683,486],[687,496],[688,508],[685,518],[678,529],[667,537],[651,543],[636,547],[621,546],[607,542],[594,535],[584,526],[578,516],[577,503],[578,492],[584,481],[587,475],[574,464],[562,450],[553,436],[548,425]],np.float32)
ref=np.array(Image.open(p/'cel25cc-CC003-source.png').convert('RGB'))
x0,y0,x1,y1=540,410,728,553;template=ref[y0:y1,x0:x1];mask=np.zeros(template.shape[:2],np.uint8);cv2.fillPoly(mask,[(stamp-[x0,y0]).astype('int32')],255);mask=cv2.erode(mask,np.ones((5,5),np.uint8));mask[80:,:80]=0;mask[80:,110:]=0
# Register only the already identified stamp shape; exclude numerals so 25 and 30 can share silhouette evidence.
def locate(im,scales,min_y=0):
 best=None;small=cv2.resize(im,None,fx=.4,fy=.4)
 def match(img,scale,minimum=0):
  t=cv2.resize(template,None,fx=scale,fy=scale);m=cv2.resize(mask,(t.shape[1],t.shape[0]),interpolation=cv2.INTER_NEAREST)
  score=cv2.matchTemplate(img,t,cv2.TM_SQDIFF_NORMED,mask=m);score[~np.isfinite(score)]=999;score[:int(minimum),:]=999
  _,_,pos,_=cv2.minMaxLoc(score);return float(score[pos[1],pos[0]]),pos
 for scale in scales:
  value,pos=match(small,scale*.4,min_y*.4)
  if best is None or value<best[0]:best=(value,scale,tuple(v/.4 for v in pos))
 _,scale,pos=best;left=max(0,int(pos[0])-10);top=max(0,int(pos[1])-10);crop=im[top:min(im.shape[0],int(pos[1]+template.shape[0]*scale+15)),left:min(im.shape[1],int(pos[0]+template.shape[1]*scale+15))]
 refined=None
 for ratio in ([scale] if len(scales)==1 else np.arange(scale-.02,scale+.0201,.002)):
  if template.shape[0]*ratio>crop.shape[0] or template.shape[1]*ratio>crop.shape[1]:continue
  value,at=match(crop,ratio)
  if refined is None or value<refined[0]:refined=(value,ratio,(at[0]+left,at[1]+top))
 score,scale,pos=refined;pts=(stamp-[x0,y0])*scale+pos
 return score,pts.tolist()

rect=lambda l,t,r,b:[[l,t],[r,t],[r,b],[l,b]]
badge=[[88,174],[91,178],[101,174],[110,183],[117,189],[128,182],[133,177],[140,182],[146,178],[149,171],[155,169],[162,164],[165,161],[166,154],[174,145],[182,137],[180,134]]
classic25={
 1:badge+[[641,134],[641,523],[88,523]],2:badge+[[641,134],[641,523],[88,523]],3:badge+[[641,134],[641,523],[88,523]],
 4:rect(79,249,658,572),5:badge+[[643,134],[643,523],[89,523]],6:rect(79,249,658,572),
 7:rect(90,134,642,523),8:rect(90,134,642,523),9:rect(90,134,642,523),
 11:rect(65,106,668,478),12:rect(85,163,649,501),
 16:[[61,175],[68,182],[83,188],[99,188],[119,180],[133,167],[141,151],[145,135],[148,132],[248,132],[265,125],[282,110],[299,104],[670,104],[670,518],[61,518]]}
# 30th Classic original-era windows fitted to the displayed TCGplayer scans,
# measured as fractions to account for that CDN's native source dimensions.
classic30={1:[(x/734,y/1024) for x,y in badge+[[641,134],[641,523],[88,523]]],
 2:rect(.077,.103,.918,.465),3:rect(.072,.103,.918,.465),5:rect(.111,.239,.908,.558),6:rect(.077,.104,.922,.466),7:rect(.113,.123,.888,.513),10:rect(.05,.103,.94,.509),
 11:rect(.05,.104,.942,.5),14:rect(.119,.131,.877,.515),15:rect(.119,.131,.879,.515),29:rect(.258,.124,.915,.491)}
# A lower-corner owner medallion is printed over Crobat G's illustration.
classic30[11]=[[.05,.104],[.942,.104],[.942,.463],[.916,.453],[.886,.455],[.857,.47],[.847,.495],[.05,.5]]
# Charizard's displayed 717x1000 scan has a slightly shifted illustration edge.
# Preserve the traced badge contour; use this scan's own inner frame boundaries.
classic30[1]=[(max(89/717,x),y) for x,y in classic30[1][1:-3]]+[(629/717,134/1024),(629/717,512/1000),(89/717,512/1000)]
urls={x['id']:x['url'] for x in json.load(open(p/'art-sources.json'))}
products=json.load(open(p/'group-24837.json'))['results'];manual={3:716157,4:716158,18:716198,19:716199,20:716200,22:716203}
records=[];maps=[]
def add(raw,file,points,era,url,scales,layout="",alternate=False):
 im=Image.open(file).convert('RGB');w,h=im.size;below=re.fullmatch(r'30th-0(?:2[3-9]|[34][0-9]|5[0-2])',raw['id'])
 if below:score,logo=0,rect(90,440,510,710) # Entire mark is below the illustration; this region never intersects the window.
 else:score,logo=locate(np.array(im),scales)
 if score>.1:print('STAMP REVIEW',raw['id'],score,flush=True)
 field=Polygon(points);exclude=Polygon(logo).buffer(1.5,join_style='mitre');result=field.difference(exclude).simplify(.5,preserve_topology=True)
 parts=list(result.geoms) if result.geom_type=='MultiPolygon' else [result]
 rings=[ring for part in parts for ring in [list(part.exterior.coords)]+[list(r.coords) for r in part.interiors]]
 # CSS evenodd with a twice-traversed bridge to each inner ring, never XOR outside the artwork.
 joined=rings[0][:]
 for hole in rings[1:]:joined+=hole+[joined[-1]]
 css='polygon(evenodd, '+','.join(f'{x/w*100:.6f}% {y/h*100:.6f}%' for x,y in joined)+')'
 key='pk-'+raw['id']+('-'+layout if layout else '')+'-art';entry={'id':raw['id'],'name':raw['name'],'era':era,'source':url,'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'width':w,'height':h,'window':points,'stamp':logo,'stampNote':'Mark lies below artwork; bounding region only, no contour required.' if below else 'Registered outer silhouette with 1.5 native pixel clearance','stampRegistrationError':None if below else round(score,6),'rings':rings,'mask':key,'css':css}
 if alternate:next(e for id,e in maps if id==raw['id']).setdefault('alternates',[]).append(entry)
 else:records.append(entry);maps.append((raw['id'],entry))
 overlay=Image.new('RGBA',im.size);od=ImageDraw.Draw(overlay);
 for part in parts:
  od.polygon(list(part.exterior.coords),fill=(10,245,185,35))
  for hole in part.interiors:od.polygon(list(hole.coords),fill=(0,0,0,0))
 im=Image.alpha_composite(im.convert('RGBA'),overlay);d=ImageDraw.Draw(im)
 for ring in rings:d.line(ring,fill='#00ffb2',width=2)
 im.thumbnail((300,420));return im
views={}
for n,pts in classic25.items():
 id=f'cel25cc-CC{n:03}';raw=json.load(open(p/(id+'.json')));views[id]=add(raw,p/(id+'-source.png'),pts,'base/wotc' if n<10 else 'ex' if n<13 else 'dp',urls[id],[1.0])
for n,pts in classic30.items():
 id=f'30th-c-{n:03}';raw=json.load(open(p/(id+'.json')));f=p/(id+'-source.jpg');w,h=Image.open(f).size;points=[(x*w,y*h) for x,y in pts];pid=manual.get(n) or next(x['productId'] for x in products if x['name']==raw['name']);url=f'https://tcgplayer-cdn.tcgplayer.com/product/{pid}_in_1000x1000.jpg';views[id]=add(raw,f,points,'original-era',url,np.arange(.6,1.31,.025)*w/734)
for f in sorted(p.glob('30th-[0-9]*-high.webp')):
 id=f.name.replace('-high.webp','');raw=json.load(open(p/(id+'.json')));number=int(raw['localId']);w,h=Image.open(f).size
 if number==154:points=rect(3,3,w-3,h-3);era='reviewed-full-art'
 elif raw['category']=='Trainer':points=rect(52,120,553,425);era='30th-trainer'
 elif raw.get('stage') in ['Stage1','Stage2']:
  points=[[52,154],[66,153],[80,148],[94,137],[104,125],[109,111],[112,96],[393,96],[403,91],[414,83],[553,83],[553,390],[52,390]];era='30th-evolved'
 else:points=rect(52,83,553,390);era='30th-basic'
 views[id]=add(raw,f,points,era,raw['image']+'/high.webp',np.arange(.4,1.85,.05))
# Professor's Research has an illustration that continues out of the rectangular frame.
professor=json.load(open(p/'cel25-23.json'));professor_views=[]
for i,geometry in enumerate(json.load(open(p/'cel25-23-windows.json'))['sources']):
 file=p/geometry['file'];layout='tcgdex' if file.suffix=='.webp' else 'pokemontcg';url=professor['image']+'/high.webp' if layout=='tcgdex' else 'https://images.pokemontcg.io/cel25/23_hires.png'
 professor_views.append(add(professor,file,geometry['window'],'extended-trainer',url,np.arange(.7,1.16,.025)*geometry['width']/734,layout=layout,alternate=bool(i)))
proof=Image.new('RGB',(620,460),'#15191e');draw=ImageDraw.Draw(proof)
for i,im in enumerate(professor_views):proof.paste(im,(310*i,0));draw.text((310*i+5,430),['TCGdex source','Pokemon TCG source'][i],fill='white')
(root/'review/anniversary-mapping').mkdir(exist_ok=True);proof.save(root/'review/anniversary-mapping/professor-research-map.jpg',quality=90)
# A source-complete audit includes unsupported special fronts, without adding finishes.
for setid,pat in [('cel25cc','cel25cc-CC*.json'),('30th-c','30th-c-0*.json'),('30th','30th-[0-9]*.json')]:
 for f in sorted(p.glob(pat)):
  raw=json.load(open(f));id=raw['id']
  if id in views:continue
  records.append({'id':id,'name':raw['name'],'status':'unavailable','reason':'Special foil/frame layout has no measured coverage; no era or full-card fallback.'})
  file=p/(id+('-source.png' if setid=='cel25cc' else '-source.jpg' if setid=='30th-c' else '-low.webp'));im=Image.open(file).convert('RGB');im.thumbnail((300,420));views[id]=im
for setid,ids in [('25th',[f'cel25cc-CC{n:03}' for n in range(1,26)]),('30th-classic',[f'30th-c-{n:03}' for n in range(1,31)]),('30th-main',[f'30th-{n:03}' for n in range(1,159)])]:
 out=Image.new('RGB',(5*310,((len(ids)+4)//5)*460),'#15191e');d=ImageDraw.Draw(out)
 for i,id in enumerate(ids):
  x=i%5*310;y=i//5*460;out.paste(views[id],(x,y));d.text((x+5,y+422),id,fill='white');d.text((x+5,y+438),'MAPPED + STAMP EXCLUSION' if any(r['id']==id and 'css'in r for r in records) else 'PREVIEW UNAVAILABLE',fill='#00efb2' if any(r['id']==id and 'css'in r for r in records) else '#c4c8ce')
 (root/'review/anniversary-mapping').mkdir(exist_ok=True);out.thumbnail((1000,20000));out.save(root/f'review/anniversary-mapping/{setid}-map.jpg',quality=85,subsampling=0)
(p/'geometry.json').write_text(json.dumps({'retrieved':'2026-10-20','method':'Individual source-image illustration windows; separately registered anniversary-stamp silhouettes subtracted geometrically from each window. Small outward margin on printed stamp edge. Does not authenticate physical foil.','limits':'Reference-art simulation. Unsupported ex/EX/GX, Star, Shining, Prime, LV.X, BREAK, LEGEND and other special fronts remain unavailable. 30th catalogue currently declares generated Normal variants; mapping never adds or changes finish availability.','cards':records},indent=2)+'\n')
def compiled(entry):
 result={key:entry[key] for key in ['mask','css','source']}
 if entry.get('alternates'):result['alternates']=[compiled(e) for e in entry['alternates']]
 return result
(p/'compiled-masks.json').write_text(json.dumps({id:compiled(e) for id,e in maps},indent=2)+'\n')
print('MAPPED',len(maps),'explicit unavailable',len(records)-len(maps),flush=True)

# A card-wide stamp exclusion clips every finish layer, including the detail lamp.
# Full-art materials keep their existing region/texture; only the printed mark clears.
known={e['file']:e for _,root_entry in maps for e in [root_entry]+root_entry.get('alternates',[])}
stamp_records=[];seen=set()
def stamp_record(raw,file,url,tag=''):
 if file.name in seen:return
 seen.add(file.name);im=Image.open(file).convert('RGB');w,h=im.size;known_entry=known.get(file.name)
 if known_entry:logo=known_entry['stamp'];score=known_entry['stampRegistrationError']
 else:score,logo=locate(np.array(im),np.arange(.65,1.36,.025)*w/734)
 if score is not None and score>.1:print('STAMP REVIEW',raw['id'],file.name,score,flush=True)
 exclusion=Polygon(logo).buffer(1.5,join_style='mitre');field=box(0,0,w,h).difference(exclusion);parts=list(field.geoms) if field.geom_type=='MultiPolygon' else [field]
 rings=[ring for part in parts for ring in [list(part.exterior.coords)]+[list(r.coords) for r in part.interiors]];joined=rings[0][:]
 for hole in rings[1:]:joined+=hole+[joined[-1]]
 css='polygon(evenodd, '+','.join(f'{x/w*100:.6f}% {y/h*100:.6f}%' for x,y in joined)+')';center=polylabel(exclusion,tolerance=1);radius=min(8,center.distance(exclusion.boundary)/3)
 entry={'id':raw['id'],'file':file.name,'source':url,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'width':w,'height':h,'stamp':logo,'registrationError':score,'mask':'pk-'+raw['id']+('-'+tag if tag else '')+'-stamp-clear','css':css,'witness':[(center.x-radius)/w,(center.y-radius)/h,(center.x+radius)/w,(center.y+radius)/h]}
 if known_entry:entry['artMask']=known_entry['mask']
 stamp_records.append(entry)
for id,entry in maps:
 for e in [entry]+entry.get('alternates',[]):stamp_record({'id':id},p/e['file'],e['source'],'tcgdex' if id=='cel25-23' and e['file'].endswith('.webp') else 'pokemontcg' if id=='cel25-23' else '')
# Unsupported Classic layouts still get an unfoiled printed stamp on their neutral lamp.
for number in range(1,26):
 id=f'cel25cc-CC{number:03}';stamp_record({'id':id},p/(id+'-source.png'),urls[id])
regular_sources=json.load(open(p/'cel25-image-sources.json'))
for e in regular_sources:
 if 'error' not in e:stamp_record({'id':e['id']},p/e['file'],e['source'],'tcgdex' if e['file'].endswith('.webp') else 'pokemontcg')
(p/'stamp-geometry.json').write_text(json.dumps({'method':'Card-wide printed anniversary-mark exclusion, applied after material layers and spotlight. Native source silhouette plus 1.5-pixel clearance. Existing below-art-only 30th mark regions retain their conservative recorded bounds. No finish availability or pricing changes.','profiles':stamp_records},indent=2)+'\n')
# Contact sheet checks every regular Celebrations logo against its own source image.
contact=Image.new('RGB',(5*310,5*460),'#15191e');draw=ImageDraw.Draw(contact)
for number in range(1,26):
 id=f'cel25-{number}';entry=next((e for e in stamp_records if e['id']==id and e['file'].endswith('.webp')),None) or next(e for e in stamp_records if e['id']==id);im=Image.open(p/entry['file']).convert('RGB');d=ImageDraw.Draw(im);d.line(entry['stamp']+[entry['stamp'][0]],fill='#00ffb2',width=3);im.thumbnail((300,420));x=(number-1)%5*310;y=(number-1)//5*460;contact.paste(im,(x,y));draw.text((x+5,y+430),id+' - printed mark excluded',fill='#00efb2')
contact.thumbnail((1000,20000));contact.save(root/'review/anniversary-mapping/25th-regular-stamps.jpg',quality=85,subsampling=0)

def aliases(id,source):
 images=[source]
 if source.endswith('/high.webp'):images.append(source.replace('/high.webp','/low.webp'))
 if source.endswith('_hires.png'):images.append(source.replace('_hires.png','.png'))
 if id.startswith('30th-c-'):images+=[source.replace('_in_1000x1000','_400w'),f'/img/ptcg/l/{id}.jpg',f'/img/ptcg/s/{id}.jpg']
 return images
def enrich(id,data):
 data['images']=aliases(id,data['source']);data['effect']='ptcg-full-art' if id=='30th-154' else 'ptcg-holo'
 for alternate in data.get('alternates',[]):enrich(id,alternate)
 return data
maps=json.load(open(p/'compiled-masks.json'))
text='// Source-bound anniversary illustration and printed-mark masks.\n// Generated from retained native source images; does not create finishes or prices.\nexport const ANNIVERSARY_MAPS = Object.freeze({\n'
for id,data in maps.items():text+=' '+json.dumps(id)+':'+json.dumps(enrich(id,data),separators=(',',':'))+',\n'
text+='});\nexport const ANNIVERSARY_STAMPS = Object.freeze({\n';by_id={}
for e in stamp_records:
 profile={key:e[key] for key in ['mask','css','source']};profile['images']=aliases(e['id'],e['source'])
 if e.get('artMask'):profile['artMask']=e['artMask']
 by_id.setdefault(e['id'],[]).append(profile)
for id,data in by_id.items():text+=' '+json.dumps(id)+':'+json.dumps(data,separators=(',',':'))+',\n'
text+='});\n';(root/'pokemon-anniversary-masks.js').write_text(text)
print('STAMP PROFILES',len(stamp_records),'card identities',len(by_id),flush=True)
