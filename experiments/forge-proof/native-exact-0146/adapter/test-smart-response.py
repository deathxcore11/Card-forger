exec(compile(open(__file__.replace('test-smart-response.py','test-http.py')).read(),'test-http.py','exec'))
# Test only visible information: keep Thirst for Knowledge and mana available until an AI spell is on stack.
for step in range(160):
 s=get()
 if s['status']!='running':raise RuntimeError('Game ended before response fixture')
 if s['busy']:time.sleep(.05);continue
 own=next(p for p in s['players'] if p['isViewer'])
 if s['activePlayer']!=s['viewer'] and s['stack'] and s['inputType']=='InputPassPriority' and own['hasAvailableActions']:
  thirst=next((c for c in own['zones']['Hand']['cards'] if c['name']=='Thirst for Knowledge'),None)
  if thirst:
   record(s,'smart-real-response-held');assert s['controlMode']=='smart' and s['autoPassNoActions']
   print('PASS Smart held real response with opponent spell on native stack',s['stack'][0]['text'],flush=True)
   assert action(s,'card',id=thirst['id'])[0]==202
   s=wait(s);record(s,'smart-real-response-cast')
   if s['prompt']:raise RuntimeError('Unexpected response dialog '+json.dumps(s['prompt']))
   assert s['nativeAutoPayments']==2
   assert any(x.get('source',{}).get('name')=='Thirst for Knowledge' for x in s['stack'])
   assert 'discard' in s['message'] and s['selection']['min']==2
   assert s['selection']['chosen']==[] # Never auto-select the consequential discard decision.
   record(s,'smart-real-response-paid')
   print('PASS Smart real response cast/auto-paid through native input; actual discard choice remains manual; no hidden-library access',flush=True)
   break
 p=s['prompt']
 if p:
  if not p['supported']:raise RuntimeError('unsupported '+str(p))
  r=action(s,'reply',promptId=p['id'],indexes=[o['index'] for o in p['options'][:p['min']]])
 elif s['buttons'].get('okEnabled'):r=action(s,'ok')
 elif s['selection']['cards']:
  chosen={x['id'] for x in s['selection']['chosen']};r=action(s,'card',id=next(x['id'] for x in s['selection']['cards'] if x['id'] not in chosen))
 else:raise RuntimeError('No native test action')
 if r[0]==409:continue
 assert r[0]==202
 s=wait(s)
else:raise RuntimeError('No opponent response observed within game fixture')
