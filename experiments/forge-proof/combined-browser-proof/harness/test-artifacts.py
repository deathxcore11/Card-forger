#!/usr/bin/env python3
"""Sanitizer boundary tests only; no gameplay/screenshots claimed."""
import base64, json, pathlib, subprocess, tempfile, unittest
HERE=pathlib.Path(__file__).resolve().parent
CANARY='PRIVATE_CANARY_NEVER_UPLOAD'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
def visual(stage):
 box={'x':1,'y':1,'width':40,'height':44}
 return {'stage':stage,'width':750,'height':832,'visibleHandCards':7,'imageCount':7,'imagesReady':7,'compact':True,'lifeVisible':[True,True],'exposure':{k:{'visible':True,'opacity':1,'areaRatio':1,'hits':5} for k in ['hand','you','cpu','dock']},**{k:box for k in ['hand','you','cpu','dock']},'controls':[{**box,'receivesPointer':True}]*3,'rawBody':CANARY,'imageUrl':CANARY}
def lifecycle(n,image='sha256:'+'1'*64):
 return {'confirmed':True,'privateInputRemoved':True,'starts':n,'destroys':n,'lifecycle':{'confirmed':True,'imageId':image,'allocations':[{'scope':'LOCAL_TEST_NOT_DEPLOYABLE','imageId':image,'containerId':str(i+1)*64,'sameImage':True,'confirmed':True,'removed':True,'privateInputRemoved':True,'forced':False,'oomKilled':False,'running':False,'status':'exited','exitCode':0,'starts':1,'destroys':1} for i in range(n)]}}
class Artifacts(unittest.TestCase):
 def run_case(self,change=lambda raw:None):
  with tempfile.TemporaryDirectory(prefix='combined-artifact-test-') as tmp:
   root=pathlib.Path(tmp);raw=root/'raw';out=root/'artifact'
   for name in ['desktop','touch750']:
    p=raw/name;p.mkdir(parents=True)
    data={'result':'passed','difficultySelections':['Easy','Hard','Medium'],'creates':2 if name=='desktop' else 1,'naturalFinish':name=='desktop','rematchVerified':name=='desktop','visualChecks':[visual('first-main'),visual('resolved')],'errors':[],'rawSnapshot':CANARY,'observation':{'method':'fixture-forwarded-viewer-response-cache','intervalMs':250,'reads':20,'accepted':10,'body':CANARY,'token':CANARY},'failure':{'message':CANARY}}
    (p/'summary.json').write_text(json.dumps(data));(p/'lifecycle.json').write_text(json.dumps(lifecycle(2 if name=='desktop' else 1)))
    for png in ['setup.png','opening.png','resolved.png','complete.png']+(['terminal.png'] if name=='desktop' else []):(p/png).write_bytes(PNG)
   change(raw)
   result=subprocess.run(['python3',str(HERE/'artifacts.py'),str(raw),str(out),'0','complete'],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr)
   for p in out.rglob('*'):
    if p.is_file():self.assertNotIn(CANARY.encode(),p.read_bytes())
   return json.loads((out/'summary.json').read_text())
 def test_nested_canaries_never_cross_metadata_boundary(self):
  def change(raw):
   for p in raw.glob('*/summary.json'):
    d=json.loads(p.read_text());d.update(terminal={'draw':False,'winnerPlayerId':1,'rawSnapshot':CANARY},concession={'draw':False,'winnerPlayerId':1,'rawSnapshot':CANARY},failedAction={'stage':CANARY,'geometry':{'rawSnapshot':CANARY,'rect':{'x':0,'y':0,'width':1,'height':1,'raw':CANARY},'hitCardId':CANARY}},viewport={'width':1440,'height':1000,'raw':CANARY},checks=[CANARY],selectedDigests={'raw':CANARY},handPan={'overflow':True,'raw':CANARY,'before':{'left':0,'max':1,'raw':CANARY}},scope=CANARY,browser=CANARY,case=CANARY);p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'passed')
 def test_safe_geometry_and_flags_only(self):self.assertEqual(self.run_case()['result'],'passed')
 def test_missing_natural_result_fails(self):
  def change(raw):
   p=raw/'desktop/summary.json';d=json.loads(p.read_text());d['naturalFinish']=False;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'failed')
 def test_missing_terminal_screenshot_fails(self):self.assertEqual(self.run_case(lambda raw:(raw/'desktop/terminal.png').unlink())['result'],'failed')
 def test_incomplete_cleanup_fails(self):
  def change(raw):
   p=raw/'desktop/lifecycle.json';d=json.loads(p.read_text());d['destroys']=1;d['rawPrivate']=CANARY;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'failed')
 def test_private_input_removal_required(self):
  def change(raw):
   p=raw/'desktop/lifecycle.json';d=json.loads(p.read_text());d['privateInputRemoved']=False;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'failed')
 def test_forced_allocation_cleanup_fails(self):
  def change(raw):
   p=raw/'desktop/lifecycle.json';d=json.loads(p.read_text());d['lifecycle']['allocations'][0]['forced']=True;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'failed')
 def test_duplicate_container_receipt_fails(self):
  def change(raw):
   p=raw/'desktop/lifecycle.json';d=json.loads(p.read_text());d['lifecycle']['allocations'][1]['containerId']=d['lifecycle']['allocations'][0]['containerId'];p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'failed')
 def test_malformed_geometry_fails(self):
  def change(raw):
   p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['visualChecks'][0]['hand']['x']=CANARY;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'failed')
if __name__=='__main__':unittest.main()
