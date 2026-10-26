#!/usr/bin/env python3
"""Sanitizer boundary tests only; no gameplay/screenshots claimed."""
import base64, json, pathlib, subprocess, tempfile, unittest
from payment_artifacts import payment_proof
HERE=pathlib.Path(__file__).resolve().parent
CANARY='PRIVATE_CANARY_NEVER_UPLOAD'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
def visual(stage):
 box={'x':1,'y':1,'width':40,'height':44}
 return {'stage':stage,'width':750,'height':832,'visibleHandCards':7,'imageCount':7,'imagesReady':7,'compact':True,'lifeVisible':[True,True],'exposure':{k:{'visible':True,'opacity':1,'areaRatio':1,'hits':5} for k in ['hand','you','cpu','dock']},**{k:box for k in ['hand','you','cpu','dock']},'controls':[{**box,'receivesPointer':True}]*3,'rawBody':CANARY,'imageUrl':CANARY}
def payment():
 return {'schema':'cardstashy.mimic-payment-browser.v1','seed':20261025,'sequence':'saved-keen-mimic-v1','controlMode':'smart',**{k:1 for k in ['stackEntries','uniqueStackItems','maxStackCopies','castRequests','castAccepted','autoPayments']},'tappedLands':2,'lifeSpent':0,'spellOnBattlefield':True,'controlsResumed':True,'result':'passed','rawPrivate':CANARY}
def lifecycle(n,image='sha256:'+'1'*64):
 return {'confirmed':True,'privateInputRemoved':True,'starts':n,'destroys':n,'lifecycle':{'confirmed':True,'imageId':image,'allocations':[{'scope':'LOCAL_TEST_NOT_DEPLOYABLE','imageId':image,'containerId':str(i+1)*64,'sameImage':True,'confirmed':True,'removed':True,'privateInputRemoved':True,'forced':False,'oomKilled':False,'running':False,'status':'exited','exitCode':0,'starts':1,'destroys':1} for i in range(n)]}}
class Artifacts(unittest.TestCase):
 def run_case(self,change=lambda raw:None):
  with tempfile.TemporaryDirectory(prefix='combined-artifact-test-') as tmp:
   root=pathlib.Path(tmp);raw=root/'raw';out=root/'artifact'
   for name in ['desktop','touch750']:
    p=raw/name;p.mkdir(parents=True)
    data={'result':'passed','paymentProof':payment(),'difficultySelections':['Easy','Hard','Medium'],'creates':2 if name=='desktop' else 1,'naturalFinish':name=='desktop','rematchVerified':name=='desktop','visualChecks':[visual('first-main'),visual('resolved')],'errors':[],'rawSnapshot':CANARY,'observation':{'method':'fixture-forwarded-viewer-response-cache','intervalMs':250,'reads':20,'accepted':10,'body':CANARY,'token':CANARY},'failure':{'message':CANARY}}
    (p/'summary.json').write_text(json.dumps(data));(p/'lifecycle.json').write_text(json.dumps(lifecycle(2 if name=='desktop' else 1)))
    for png in ['setup.png','opening.png','resolved.png','complete.png']+(['terminal.png'] if name=='desktop' else []):(p/png).write_bytes(PNG)
   change(raw)
   result=subprocess.run(['python3',str(HERE/'artifacts.py'),str(raw),str(out),'0','complete'],capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr)
   for p in out.rglob('*'):
    if p.is_file():self.assertNotIn(CANARY.encode(),p.read_bytes())
   self.cases={name:json.loads((out/name/'summary.json').read_text()) for name in ['desktop','touch750']}
   return json.loads((out/'summary.json').read_text())
 def test_nested_canaries_never_cross_metadata_boundary(self):
  def change(raw):
   for p in raw.glob('*/summary.json'):
    d=json.loads(p.read_text());d.update(terminal={'draw':False,'winnerPlayerId':1,'rawSnapshot':CANARY},concession={'draw':False,'winnerPlayerId':1,'rawSnapshot':CANARY},failedAction={'stage':CANARY,'geometry':{'rawSnapshot':CANARY,'rect':{'x':0,'y':0,'width':1,'height':1,'raw':CANARY},'hitCardId':CANARY}},viewport={'width':1440,'height':1000,'raw':CANARY},checks=[CANARY],selectedDigests={'raw':CANARY},handPan={'overflow':True,'raw':CANARY,'before':{'left':0,'max':1,'raw':CANARY}},scope=CANARY,browser=CANARY,case=CANARY);p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'passed')
 def test_safe_geometry_and_flags_only(self):self.assertEqual(self.run_case()['result'],'passed')
 def test_missing_or_incomplete_payment_proof_fails(self):
  for value in [None,{},dict(payment(),result='incomplete'),dict(payment(),controlsResumed=False),dict(payment(),spellOnBattlefield=False)]:
   with self.subTest(value=value):
    def change(raw):
     p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['paymentProof']=value;p.write_text(json.dumps(d))
    self.assertEqual(self.run_case(change)['result'],'failed')
 def test_payment_counts_and_original_scenario_are_required(self):
  changes={'stackEntries':2,'uniqueStackItems':0,'maxStackCopies':2,'castRequests':2,'castAccepted':0,'autoPayments':2,'tappedLands':1,'lifeSpent':1,'seed':0,'sequence':CANARY,'controlMode':'full','schema':CANARY}
  for key,value in changes.items():
   with self.subTest(key=key):
    proof=payment();proof[key]=value;clean=payment_proof(proof)
    self.assertEqual(clean['result'],'incomplete');self.assertNotIn(CANARY,json.dumps(clean))
 def test_payment_booleans_and_compound_counts_cannot_pass(self):
  for value in [True,1.0,'1',{'private':CANARY},[1],-1]:
   with self.subTest(value=value):
    proof=payment();proof['autoPayments']=value;clean=payment_proof(proof)
    self.assertEqual(clean['result'],'incomplete');self.assertIsNone(clean['autoPayments']);self.assertNotIn(CANARY,json.dumps(clean))
 def test_event_order_is_bounded_and_only_safe_identity_survives(self):
  def change(raw):
   p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['actionEvents']=[{'order':i,'event':'action-submitted','requestRevision':10,'observedRevision':11,'decisionId':4,'requestDecisionId':3,'commandHash':'a'*64,'generationHash':'b'*64,'operation':'reply','inputType':'InputPayMana','busy':False,'body':CANARY,'generation':CANARY} for i in range(300)];d['actionEventsTruncated']=True;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'passed');case=self.cases['touch750'];self.assertTrue(case['actionEventsTruncated']);events=case['actionEvents'];self.assertEqual(len(events),256)
  self.assertEqual([e['order'] for e in events],list(range(256)))
  self.assertTrue(all(e['requestRevision']==10 and e['observedRevision']==11 and e['requestDecisionId']==3 and e['decisionId']==4 and e['commandHash']=='a'*64 for e in events))
 def test_event_metadata_rejects_private_or_invalid_values(self):
  def change(raw):
   p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['actionEvents']=[None,{'order':True,'event':CANARY,'requestRevision':-1,'observedRevision':9007199254740992,'requestDecisionId':True,'decisionId':{'private':CANARY},'busy':CANARY,'commandHash':{'private':CANARY},'generationHash':['a'*64],'inputType':CANARY,'operation':CANARY,'state':CANARY,'httpStatus':True}];p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'passed');events=self.cases['touch750']['actionEvents'];self.assertEqual(len(events),1);event=events[0]
  for key in ['order','requestRevision','observedRevision','decisionId','requestDecisionId','busy','commandHash','generationHash','httpStatus']:self.assertIsNone(event[key])
  for key in ['event','inputType','operation','state']:self.assertEqual(event[key],'unknown')
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
 def test_payment_rejection_metadata_retains_safe_correlation(self):
  reasons=json.loads((HERE/'action-diagnostics.json').read_text())['reasons']
  for reason in reasons:
   with self.subTest(reason=reason):
    def change(raw):
     p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['actionRejection']={'stage':'native InputPayManaOfCostPayment','inputType':'InputPayManaOfCostPayment','httpStatus':409,'reason':reason,'state':'rejected','observedRevision':12,'requestRevision':11,'decisionId':4,'requestDecisionId':3,'operation':'ok','commandHash':'a'*64,'receiptCommandHash':'a'*64,'generationHash':'b'*64,'commandId':CANARY,'generation':CANARY,'rawBody':CANARY};d['failure']={'stage':'native InputPayManaOfCostPayment','name':'AssertionError','message':CANARY};p.write_text(json.dumps(d))
    self.assertEqual(self.run_case(change)['result'],'failed')
    item=self.cases['touch750'];r=item['actionRejection'];self.assertEqual(r['reason'],reason);self.assertEqual(r['state'],'rejected');self.assertEqual(r['stage'],'native InputPayManaOfCostPayment');self.assertEqual(r['inputType'],'InputPayManaOfCostPayment');self.assertEqual(r['httpStatus'],409);self.assertEqual(r['observedRevision'],12);self.assertEqual(r['requestRevision'],11);self.assertEqual(r['decisionId'],4);self.assertEqual(r['requestDecisionId'],3);self.assertEqual(r['commandHash'],'a'*64);self.assertEqual(item['failure']['stage'],r['stage'])
 def test_rejection_metadata_never_accepts_compound_or_private_values(self):
  for value in [CANARY,'native InputPayMana '+CANARY,'native InputPayManaOfCostPayment;stale_prompt',{'secret':CANARY},[CANARY],None]:
   with self.subTest(value=value):
    def change(raw):
     p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['actionRejection']={'stage':value,'inputType':value,'httpStatus':True,'reason':value,'state':CANARY,'observedRevision':True,'requestRevision':-1,'decisionId':9007199254740992,'operation':value,'commandHash':CANARY,'generationHash':CANARY};p.write_text(json.dumps(d))
    self.assertEqual(self.run_case(change)['result'],'failed');r=self.cases['touch750']['actionRejection']
    self.assertEqual(r['stage'],'unknown');self.assertEqual(r['inputType'],'unknown');self.assertIsNone(r['reason']);self.assertEqual(r['state'],'unknown');self.assertEqual(r['operation'],'unknown')
    for key in ['httpStatus','observedRevision','requestRevision','decisionId','requestDecisionId','commandHash','receiptCommandHash','generationHash']:self.assertIsNone(r[key])
 def test_transport_or_unbound_response_is_not_native_rejection(self):
  for status,receipt_hash in [(503,'a'*64),(202,'b'*64),(409,'b'*64),(400,None)]:
   with self.subTest(status=status,receipt_hash=receipt_hash):
    def change(raw):
     p=raw/'touch750/summary.json';d=json.loads(p.read_text());d['actionRejection']={'stage':'native InputPayMana','inputType':'InputPayMana','httpStatus':status,'state':'rejected','reason':'stale_revision','commandHash':'a'*64,'receiptCommandHash':receipt_hash};p.write_text(json.dumps(d))
    self.assertEqual(self.run_case(change)['result'],'failed');r=self.cases['touch750']['actionRejection'];self.assertEqual(r['state'],'unknown');self.assertIsNone(r['reason'])
 def test_action_trail_is_bounded_and_re_sanitized(self):
  def change(raw):
   p=raw/'desktop/summary.json';d=json.loads(p.read_text());d['actionDiagnostics']=[{'stage':'native InputPayMana','inputType':'InputPayMana','httpStatus':202,'state':'accepted','reason':CANARY,'commandHash':'a'*64,'receiptCommandHash':'a'*64,'generationHash':'b'*64,'rawSnapshot':CANARY}]*70;p.write_text(json.dumps(d))
  self.assertEqual(self.run_case(change)['result'],'passed');trail=self.cases['desktop']['actionDiagnostics'];self.assertEqual(len(trail),64)
  self.assertTrue(all(d['state']=='accepted' and d['reason'] is None and d['stage']=='native InputPayMana' for d in trail))
if __name__=='__main__':unittest.main()
