import json,time,urllib.request,pathlib,sys
root=pathlib.Path(__file__).resolve().parent.parent
expected_human=sys.argv[1];expected_ai=sys.argv[2]
for _ in range(100):
 try:
  c=json.load(open(root/'adapter/connection.json'));s=json.load(urllib.request.urlopen(urllib.request.Request(c['baseUrl']+'/state',headers={'Authorization':'Bearer '+c['token']}),timeout=1))
  if s.get('revision'):break
 except Exception:pass
 time.sleep(.2)
else:raise RuntimeError('No native precon state')
assert [p['deckAlias'] for p in s['players']]==[expected_human,expected_ai]
for p in s['players']:
 assert p['life']==40 and p['deckCount']==100
 assert sum(z['count'] for z in p['zones'].values())==100
 assert p['zones']['Command']['count']==1
 assert p['zones']['Library']['cards']==[]
assert s['players'][0]['zones']['Command']['cards'][0]['name']=='Giada, Font of Hope'
(root/'logs'/('selected-'+expected_ai+'.json')).write_text(json.dumps(s,indent=2))
print('PASS selected native precons',expected_human,expected_ai,[(p['zones']['Command']['cards'][0]['id'],p['zones']['Command']['cards'][0]['name']) for p in s['players']])
