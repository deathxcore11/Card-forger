import re,ast,json,pathlib
rx=re.compile(r'\s+|//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|-?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[{}\[\]:,]')
def parse(text):
 text=re.split(r'const card\s*:\s*Card\s*=',text,maxsplit=1)[1].split('export default')[0]
 toks=[];pos=0
 for m in rx.finditer(text):
  if text[pos:m.start()].strip(' ;\n\t'):raise ValueError('unsupported '+text[pos:m.start()])
  pos=m.end();s=m.group()
  if s.isspace() or s.startswith('//') or s.startswith('/*'):continue
  toks.append(s)
 i=0
 def val():
  nonlocal i
  t=toks[i];i+=1
  if t=='{':
   d={}
   while toks[i]!='}':
    k=toks[i];i+=1;k=ast.literal_eval(k) if k[:1] in ['"',"'"] else k
    assert toks[i]==':';i+=1;d[k]=val()
    if toks[i]==',':i+=1
    else:assert toks[i]=='}'
   i+=1;return d
  if t=='[':
   a=[]
   while toks[i]!=']':
    a.append(val())
    if toks[i]==',':i+=1
    else:assert toks[i]==']'
   i+=1;return a
  if t[:1] in ['"',"'"]:return ast.literal_eval(t)
  if re.fullmatch(r'-?\d+(?:\.\d+)?',t):return float(t) if '.'in t else int(t)
  if t in ['true','false','null']:return {'true':True,'false':False,'null':None}[t]
  if t=='undefined':return {'$undefined':True}
  if t!='Set':raise ValueError('Unsupported identifier: '+t)
  return {'$identifier':t}
 out=val();assert i==len(toks);return out


def card_signals(card):
 values={}
 if isinstance(card.get('hp'),(int,float)):values['hp']=card['hp']
 if isinstance(card.get('stage'),str):values['stage']=card['stage']
 names=[a.get('name',{}).get('en') if isinstance(a.get('name'),dict) else a.get('name') for a in card.get('attacks',[]) if isinstance(a,dict)]
 names=[n for n in names if isinstance(n,str) and n]
 if names:values['attackNames']=names[:4]
 return values
