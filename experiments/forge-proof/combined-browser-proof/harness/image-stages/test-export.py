import importlib.util,io,json,hashlib,pathlib,tarfile,tempfile,unittest,sys
sys.dont_write_bytecode=True
P=pathlib.Path(__file__).with_name('export-docker-oci.py');spec=importlib.util.spec_from_file_location('oci_export',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sha=lambda b:'sha256:'+hashlib.sha256(b).hexdigest()
class Export(unittest.TestCase):
 def fixture(self,root,mutate=lambda x:x):
  layer=b'actual synthetic test layer bytes\n';config=json.dumps({'os':'linux','architecture':'amd64','rootfs':{'type':'layers','diff_ids':[sha(layer)]}},separators=(',',':')).encode()
  files={'manifest.json':json.dumps([{'Config':'config.json','RepoTags':['local-test-only:synthetic'],'Layers':['one/layer.tar']}]).encode(),'config.json':config,'one/layer.tar':layer};mutate(files)
  archive=root/'docker.tar'
  with tarfile.open(archive,'w') as t:
   for name,value in files.items():
    x=tarfile.TarInfo(name);x.size=len(value);t.addfile(x,io.BytesIO(value))
  return archive,sha(config)
 def test_actual_bytes_become_valid_local_layout(self):
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d);a,image=self.fixture(r);out=r/'oci';result=m.convert(a,out,image)
   self.assertFalse(result['deployable']);index=json.loads((out/'index.json').read_text());desc=index['manifests'][0];raw=(out/'blobs/sha256'/desc['digest'][7:]).read_bytes();self.assertEqual(sha(raw),desc['digest']);manifest=json.loads(raw);self.assertEqual(manifest['config']['digest'],image);self.assertEqual(manifest['layers'][0]['digest'],sha(b'actual synthetic test layer bytes\n'))
 def test_wrong_config_id_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d);a,_=self.fixture(r)
   with self.assertRaises(ValueError):m.convert(a,r/'oci','sha256:'+'1'*64)
 def test_wrong_layer_bytes_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d);a,image=self.fixture(r,lambda f:f.update({'one/layer.tar':b'changed'}))
   with self.assertRaises(ValueError):m.convert(a,r/'oci',image)
 def test_path_traversal_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d);a,image=self.fixture(r,lambda f:f.update({'manifest.json':json.dumps([{'Config':'../config.json','Layers':['one/layer.tar']}]).encode()}))
   with self.assertRaises(ValueError):m.convert(a,r/'oci',image)
 def test_symlink_layer_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d);a,image=self.fixture(r)
   with tarfile.open(a,'a') as t:
    x=tarfile.TarInfo('one/layer.tar');x.type=tarfile.SYMTYPE;x.linkname='/etc/passwd';t.addfile(x)
   with self.assertRaises(ValueError):m.convert(a,r/'oci',image)
if __name__=='__main__':unittest.main()
