import hashlib, http.client, importlib.util, json, os, tempfile, threading, time, unittest
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('next_gateway',HERE/'container/gateway.py');gateway=importlib.util.module_from_spec(spec);spec.loader.exec_module(gateway)
ASSETS=('rules-data/current/manifest.json','rules-data/current/cards.json','rules-data/current/official-format-facts.json','cpu/combined-native-ai.patch','cpu/runtime-sha256.json','build-ai-overlay.sh')
class NextLauncherTests(unittest.TestCase):
 def fixture(self):
  temporary=tempfile.TemporaryDirectory();self.addCleanup(temporary.cleanup);root=Path(temporary.name);distribution=root/'distribution';runtime=root/'runtime';runtime.mkdir();distribution.mkdir()
  source=distribution/'adapter/src/cardstashy/forge/ForgeHttpBridge.java';source.parent.mkdir(parents=True);source.write_text('// explicit synthetic launch gate fixture, not Java proof')
  exact=runtime/'match-input.json';exact.write_text('{"input":{}}');(distribution/'runtime-classpath.txt').write_text('fixture-CP')
  manifest={'nativeManifestSha256':'a'*64,'adapterCapabilities':['cardstashy.match-input.v1','cardstashy.formats-three.v1','cardstashy.rules-data.v1','cardstashy.experimental-heuristic-cpu.v1'],'sha256':{gateway.ADAPTER_MANIFEST_PATH:hashlib.sha256(source.read_bytes()).hexdigest()}}
  for relative in ASSETS:
   asset=distribution/relative;asset.parent.mkdir(parents=True,exist_ok=True);asset.write_text('synthetic '+relative);manifest['sha256']['experiments/forge-proof/native/'+relative]=hashlib.sha256(asset.read_bytes()).hexdigest()
  metadata=root/'checkpoint-files.json';metadata.write_text(json.dumps(manifest))
  def paths(value):
   value=str(value)
   if value=='/opt/host001/checkpoint-files.json':return metadata
   if value.startswith('/opt/forge-proof'):return distribution/Path(value).relative_to('/opt/forge-proof')
   return Path(value)
  context=patch.multiple(gateway,Path=paths,EXACT_INPUT_PATH=str(exact));context.start();self.addCleanup(context.stop)
  env=patch.dict(os.environ,{'HOST_MATCH_INPUT_PATH':str(exact),'HOST_ABSOLUTE_DEADLINE_MS':str(int(time.time()*1000)+60000),'HOST_SEED':'1'},clear=True);env.start();self.addCleanup(env.stop)
  return runtime,distribution,metadata,manifest
 def test_explicit_current_rules_and_exact_arguments_no_aliases(self):
  runtime,*_=self.fixture();command=gateway.launch_command(runtime)
  self.assertEqual(gateway.VERIFIED_IMAGE_IDENTITY['nativeManifestSha256'],'a'*64)
  self.assertIn('-Dproof.requireCurrentRules=true',command);self.assertIn('-Dproof.requireExact=true',command)
  self.assertFalse(any('proof.humanDeck' in value or 'proof.aiDeck' in value for value in command))
 def test_missing_capability_rejects_before_launch(self):
  runtime,_,metadata,manifest=self.fixture();manifest['adapterCapabilities'].remove('cardstashy.experimental-heuristic-cpu.v1');metadata.write_text(json.dumps(manifest))
  with self.assertRaisesRegex(ValueError,'capabilities'):gateway.launch_command(runtime)
 def test_tampered_or_symlinked_runtime_assets_reject(self):
  for relative in ASSETS:
   for symlink in [False,True]:
    with self.subTest(asset=relative,symlink=symlink):
     runtime,distribution,*_=self.fixture();asset=distribution/relative
     if symlink:
      target=asset.with_name(asset.name+'-target');asset.rename(target);asset.symlink_to(target)
     else:asset.write_text('tampered')
     with self.assertRaisesRegex(ValueError,'asset mismatch'):gateway.launch_command(runtime)
 def test_verified_identity_headers_cannot_be_overridden_by_request(self):
  runtime,*_=self.fixture();gateway.launch_command(runtime)
  bridge=gateway.Bridge('synthetic-native-token','synthetic-internal-token')
  bridge.forward=lambda *args,**kwargs:(200,b'{"status":"running"}')
  server=gateway.Server(('127.0.0.1',0),bridge);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2)
   connection.request('GET','/state',headers={'Authorization':'Bearer synthetic-internal-token','X-Host-Native-Source-SHA256':'f'*64})
   response=connection.getresponse();response.read();connection.close()
   self.assertEqual(response.status,200);self.assertEqual(response.getheader('X-Host-Native-Source-SHA256'),gateway.VERIFIED_IMAGE_IDENTITY['nativeSourceSha256'])
   self.assertEqual(response.getheader('X-Host-Native-Manifest-SHA256'),'a'*64)
  finally:server.shutdown();server.server_close();thread.join(timeout=2)
 def test_missing_source_manifest_identity_rejects(self):
  runtime,_,metadata,manifest=self.fixture();manifest.pop('nativeManifestSha256');metadata.write_text(json.dumps(manifest))
  with self.assertRaisesRegex(ValueError,'source-manifest identity'):gateway.launch_command(runtime)
 def test_next_image_rejects_missing_exact_input_instead_of_alias_default(self):
  runtime,*_=self.fixture();os.environ.pop('HOST_MATCH_INPUT_PATH')
  with self.assertRaisesRegex(ValueError,'requires exact'):gateway.launch_command(runtime)
 def test_assembly_generates_attestation_in_image_and_retains_runtime_source(self):
  docker=(HERE/'container/Dockerfile.template').read_text();assembly=(HERE/'container/assemble.sh').read_text();gateway_source=(HERE/'container/gateway.py').read_text()
  self.assertNotIn('COPY native/cpu/build-attestation',docker);self.assertIn('native/cpu/runtime-sha256.json',docker)
  self.assertLess(assembly.index('bash /opt/forge-proof/build-ai-overlay.sh'),assembly.index('javac -cp'))
  self.assertIn('CP="/opt/forge-proof/cpu/runtime-classes:$CP"',assembly)
  self.assertIn('("forge", "decks", "cpu", "rules-data")',gateway_source)
if __name__=='__main__':unittest.main()
