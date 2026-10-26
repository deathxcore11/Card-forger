#!/usr/bin/env python3
"""Convert an actual private docker-save stream to a local OCI image layout.
No network, extraction paths, registry names or fabricated runtime evidence.
"""
import hashlib,json,pathlib,sys,tarfile
MAX_ARCHIVE=8*1024**3
MAX_LAYER=8*1024**3
MAX_JSON=4*1024**2

def checked_member(tar,members,name,maximum):
    p=pathlib.PurePosixPath(name)
    if not isinstance(name,str) or p.is_absolute() or '..' in p.parts or name not in members:raise ValueError('invalid_docker_archive_member')
    m=members[name]
    if not m.isfile() or m.issym() or m.islnk() or m.size<1 or m.size>maximum:raise ValueError('unbounded_docker_archive_member')
    return m

def convert(archive,output,image_id):
    import re
    if not re.fullmatch(r'sha256:[0-9a-f]{64}',image_id):raise ValueError('immutable_docker_config_id_required')
    if archive.is_symlink() or not archive.is_file() or archive.stat().st_size>MAX_ARCHIVE:raise ValueError('bounded_regular_docker_save_required')
    output.mkdir(mode=0o700,exist_ok=False);blobs=output/'blobs/sha256';blobs.mkdir(mode=0o700,parents=True)
    with tarfile.open(archive,'r:') as tar:
        all_members=tar.getmembers();members={m.name:m for m in all_members}
        if len(all_members)>10000 or len(members)!=len(all_members):raise ValueError('duplicate_or_excess_archive_members')
        def read_json(name):
            m=checked_member(tar,members,name,MAX_JSON)
            with tar.extractfile(m) as f:return json.loads(f.read())
        index=read_json('manifest.json')
        if not isinstance(index,list) or len(index)!=1:raise ValueError('exactly_one_saved_image_required')
        entry=index[0];config_name=entry.get('Config');config=read_json(config_name)
        if config.get('os')!='linux' or config.get('architecture')!='amd64' or config.get('rootfs',{}).get('type')!='layers':raise ValueError('linux_amd64_layered_image_required')
        layers=entry.get('Layers');diff_ids=config['rootfs'].get('diff_ids')
        if not isinstance(layers,list) or not 1<=len(layers)<=128 or len(set(layers))!=len(layers) or len(layers)!=len(diff_ids or []):raise ValueError('image_layer_count_mismatch')
        def copy_blob(name,media,expected=None):
            m=checked_member(tar,members,name,MAX_LAYER);temp=blobs/('pending-'+str(len(list(blobs.iterdir()))));digest=hashlib.sha256();size=0
            with tar.extractfile(m) as source,temp.open('xb') as dest:
                while True:
                    chunk=source.read(1024*1024)
                    if not chunk:break
                    size+=len(chunk)
                    if size>MAX_LAYER:raise ValueError('layer_limit')
                    digest.update(chunk);dest.write(chunk)
            if size!=m.size:raise ValueError('truncated_docker_archive')
            hexdigest=digest.hexdigest();actual='sha256:'+hexdigest
            if expected is not None and actual!=expected:raise ValueError('docker_content_identity_mismatch')
            target=blobs/hexdigest
            if target.exists():temp.unlink()
            else:temp.rename(target);target.chmod(0o600)
            return {'mediaType':media,'digest':actual,'size':size}
        config_descriptor=copy_blob(config_name,'application/vnd.oci.image.config.v1+json',image_id)
        descriptors=[copy_blob(name,'application/vnd.oci.image.layer.v1.tar',expected) for name,expected in zip(layers,diff_ids)]
        manifest={'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':config_descriptor,'layers':descriptors}
        raw=json.dumps(manifest,separators=(',',':')).encode();manifest_hash=hashlib.sha256(raw).hexdigest();(blobs/manifest_hash).write_bytes(raw)
        manifest_descriptor={'mediaType':manifest['mediaType'],'digest':'sha256:'+manifest_hash,'size':len(raw),'platform':{'os':'linux','architecture':'amd64'}}
        (output/'index.json').write_text(json.dumps({'schemaVersion':2,'manifests':[manifest_descriptor]},separators=(',',':'))+'\n')
        (output/'oci-layout').write_text('{"imageLayoutVersion":"1.0.0"}\n')
        return {'scope':'LOCAL_TEST_NOT_DEPLOYABLE','deployable':False,'registryPublication':False,'ociManifestDigest':manifest_descriptor['digest'],'dockerImageId':image_id,'layers':len(layers)}

if __name__=='__main__':
    try:print(json.dumps(convert(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),sys.argv[3])))
    except Exception as e:print(json.dumps({'scope':'LOCAL_TEST_NOT_DEPLOYABLE','result':'failed','category':type(e).__name__}),file=sys.stderr);sys.exit(1)
