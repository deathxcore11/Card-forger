#!/usr/bin/env python3
# Explicitly synthetic collector fixtures; never actual image/browser evidence.
import importlib.util,json,pathlib,subprocess,tempfile,unittest
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('artifact_test',HERE/'test-artifacts.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
S='eb7dc914eaaa85636b133477c052de0c5bd30a6f4789fad190955e5f105c8969';M='9a1452d876d47f1043a9edf514930bb515611dc21cf197bae7a54c4eb0984e6b'
class Collector(unittest.TestCase):
 def run_fixture(self,alter=lambda image,probe:None,preflight_ok=True,source_stage='complete',cleanup_parts=None):
  with tempfile.TemporaryDirectory(prefix='combined-collector-test-') as tmp:
   root=pathlib.Path(tmp);imageDir=root/'image';imageDir.mkdir();out=root/'artifact'
   (root/'static-check-stage').write_text(source_stage)
   (root/'cleanup-outcomes.json').write_text(json.dumps(cleanup_parts if cleanup_parts is not None else {'containersConfirmed':True,'imageConfirmed':True,'privateCanary':m.CANARY}))
   (root/'cleanup-preflight.json').write_text(json.dumps({'schema':'cardstashy.cleanup-preflight.v1','result':'passed','procfsMatchesNamespace':preflight_ok,'testsRun':11,'failures':0,'errors':0,'skipped':0,'requiredTests':11,'privateCanary':m.CANARY}))
   for name in ['desktop','touch750']:
    p=root/'raw'/name;p.mkdir(parents=True);n=2 if name=='desktop' else 1
    d={'result':'passed','paymentProof':m.payment(),'difficultySelections':['Easy','Hard','Medium'],'creates':n,'naturalFinish':n==2,'rematchVerified':n==2,'visualChecks':[m.visual('first-main'),m.visual('resolved')],'errors':[]}
    (p/'summary.json').write_text(json.dumps(d));(p/'lifecycle.json').write_text(json.dumps(m.lifecycle(n)))
    for png in ['setup.png','opening.png','resolved.png','complete.png']+(['terminal.png'] if n==2 else []):(p/png).write_bytes(m.PNG)
   common={'scope':'LOCAL_TEST_NOT_DEPLOYABLE','deployable':False,'registryPublication':False,'result':'passed','ociManifestDigest':'sha256:'+'2'*64,'rawState':m.CANARY,'token':m.CANARY}
   image={**common,'schema':'cardstashy.local-oci-build-summary.v1','contextManifestSHA256':'d4b87fa77148c2075e2f11a7cfc3277f018c5071f16dda5ca6e72b8763f4c9a7','buildImage':'maven:3.9.11-eclipse-temurin-21@sha256:463a1849665463254b2dd56e3a5b316f1596bc93d0571065c06ea05bb48ab8f4','runtimeImage':'eclipse-temurin:21-jre-jammy@sha256:8ecbec1f32912979c15b86aaf98f7082a77d318a7f92af3d9fe2c0fd2723df10','imageId':'sha256:'+'1'*64,'nativeSourceSHA256':S,'nativeManifestSHA256':M}
   probe={**common,'schema':'cardstashy.local-oci-probe-summary.v1','sameImageId':image['imageId'],'sourceSHA256':S,'nativeManifestSHA256':M,'policyVersion':'forge-heuristic-medium-beta-v1','buildCompilerVersion':'javac 21.0.9','runtimeJavaVersion':'21.0.9+10',**{k:'3'*64 for k in ['nativeBuildAttestationSha256','runtimeClassSetSha256','aiPatchsetSha256','selectedProfileSHA256','rulesManifestSHA256','humanDigest','opponentDigest']},**{k:True for k in ['exactRosterVerified','cpuRulesRuntimeVerified','privacyGatePassed','registeredRosterVerified','nativeRosterVerified']},'cleanup':{'confirmed':True,'privateInputRemoved':True,'removed':True,'forced':False,'starts':1,'destroys':1,'exitCode':0,'status':'exited','oomKilled':False,'rawEnv':m.CANARY}}
   probe.update(runtimeClassSetSha256='e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80',aiPatchsetSha256='cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1',selectedProfileSHA256='d77ec318868fcdb8fe1dce8d8c2df336fe26d54e13b51f7aab13d259bdf70330',rulesManifestSHA256='374282d37829bf78913508db7d2e7f85e3c85e2c9bf282e4c72e196fec8621c1')
   probe.update(humanPriorityRuntimeVerified=True,humanPrioritySourceSha256='23b9220fb5fe8646ab3784a2e19c6c43d968dabed719bc8c59c88f00cc26350c',humanPriorityClassesSha256='61ad2c7b314ce2d091f96f1fb89dfffc1e7c6634058a019e49978904b660570e',humanPriorityBuildSha256='8'*64)
   alter(image,probe)
   (imageDir/'image-summary.json').write_text(json.dumps(image));(imageDir/'probe-summary.json').write_text(json.dumps(probe))
   r=subprocess.run(['python3',str(HERE/'collect-combined.py'),str(root),str(out),'0','complete','true'],capture_output=True,text=True)
   for p in out.rglob('*'):
    if p.is_file():self.assertNotIn(m.CANARY.encode(),p.read_bytes())
   return r.returncode,json.loads((out/'summary.json').read_text())
 def test_explicit_metadata_only_pass(self):code,s=self.run_fixture();self.assertEqual(code,0);self.assertTrue(s['sameImageProbeVerified'])
 def test_different_image_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p.update(sameImageId='sha256:'+'4'*64))[0],1)
 def test_incoherent_cleanup_environment_fails(self):self.assertEqual(self.run_fixture(preflight_ok=False)[0],1)
 def test_incomplete_source_contracts_fail(self):
  code,s=self.run_fixture(source_stage='host-python');self.assertEqual(code,1);self.assertEqual(s['sourceContracts'],'host-python')
 def test_untrusted_source_details_are_not_published(self):
  code,s=self.run_fixture(source_stage=m.CANARY);self.assertEqual(code,1);self.assertEqual(s['sourceContracts'],'unknown')
 def test_separate_cleanup_outcomes_fail_closed(self):
  for field in ['containersConfirmed','imageConfirmed']:
   parts={'containersConfirmed':True,'imageConfirmed':True};parts[field]=False
   code,s=self.run_fixture(cleanup_parts=parts);self.assertEqual(code,1);self.assertFalse(s['cleanupFallbackConfirmed']);self.assertFalse(s['cleanupFallback'][field])
 def test_forced_cleanup_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p['cleanup'].update(forced=True))[0],1)
 def test_missing_attestation_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p.pop('nativeBuildAttestationSha256'))[0],1)
 def test_missing_human_attestation_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p.pop('humanPriorityBuildSha256'))[0],1)
 def test_wrong_human_classes_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p.update(humanPriorityClassesSha256='4'*64))[0],1)
 def test_unverified_human_runtime_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p.update(humanPriorityRuntimeVerified=False))[0],1)
 def test_wrong_source_fails(self):self.assertEqual(self.run_fixture(lambda i,p:p.update(sourceSHA256='4'*64))[0],1)
if __name__=='__main__':unittest.main()
