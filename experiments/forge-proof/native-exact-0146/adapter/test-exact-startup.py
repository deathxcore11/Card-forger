"""Actual single-JVM startup regression; no replacement rules and no private opponent reads."""
import json,os,pathlib,subprocess,time,urllib.request,urllib.error,tempfile
root=pathlib.Path(os.environ['ROOT']); classes=os.environ['PROOF_CLASSES']; source=pathlib.Path(__file__).resolve().parents[1]
input=json.loads((source/'fixtures/bootstrap-existing.json').read_text())
def run(label,body,missing=False):
 with tempfile.TemporaryDirectory(prefix='forge-exact-') as tmp:
  path=pathlib.Path(tmp)/'match-input.json';path.write_text(json.dumps(body));connection=root/'adapter/connection.json';connection.unlink(missing_ok=True)
  cmd=[str(root/'tools/jdk21/bin/java'),'-Xmx2g','-Djava.awt.headless=true','-Dsentry.enabled=false','-Duser.home='+str(root/'home'),'-Dproof.root='+str(root),'-Dproof.requireExact=true','-cp',classes+':'+os.environ['CP'],'cardstashy.forge.ForgeHttpBridge']
  if not missing:cmd.insert(-3,'-Dproof.matchInput='+str(path))
  with open(root/('logs/exact-'+label+'.log'),'w') as log:
   proc=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
   try:
    deadline=time.monotonic()+45
    while time.monotonic()<deadline:
     try:
      c=json.loads(connection.read_text());s=json.load(urllib.request.urlopen(urllib.request.Request(c['baseUrl']+'/state',headers={'Authorization':'Bearer '+c['token']})))
     except (FileNotFoundError,ValueError,urllib.error.URLError):time.sleep(.1);continue
     if s.get('status') in ('failed','running'):break
     time.sleep(.1)
    else:raise AssertionError('startup timeout '+label)
    if label=='valid':
     a=s['initialization']; assert a['nativeRosterVerified'] and a['registeredRosterVerified'] and a['legal'] and a['supported'];assert a['viewerId']==s['viewer'];assert not a['errors']
     for p in s['players']:
      assert p['zones']['Library']['count']==99 and p['zones']['Command']['count']==1
      assert p['zones']['Library']['cards']==[]
     assert 'nativeRoster' not in json.dumps(a) .replace('nativeRosterDigest','').replace('nativeRosterVerified','')
     (root/'logs/exact-bootstrap-state.json').write_text(json.dumps(s,indent=2))
    else:
     assert s['status']=='failed' and not s.get('players'),s
     if missing:assert s['failure']=='exact_deck_input_required'
     else:assert not(s['initialization'].get('supported') and s['initialization'].get('legal'))
    print('PASS actual JVM startup '+label,flush=True)
   finally:proc.terminate();proc.wait(timeout=10)
run('valid',input)
bad=json.loads(json.dumps(input));bad['input']['humanDeck']['cards'][1]['name']='Not A Real Card 12345';run('unknown',bad)
run('missing-required',{},True)
