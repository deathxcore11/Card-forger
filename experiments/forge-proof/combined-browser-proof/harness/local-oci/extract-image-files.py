"""LOCAL_TEST_NOT_DEPLOYABLE. Fixed immutable-image metadata allowlist only."""
import base64,json,pathlib,sys
FILES={
 'nativeSourceBytes':'/opt/forge-proof/adapter/src/cardstashy/forge/ForgeHttpBridge.java',
 'imageCheckpointBytes':'/opt/host001/checkpoint-files.json',
 'buildAttestationBytes':'/opt/forge-proof/cpu/build-attestation.json',
 'runtimeIndexBytes':'/opt/forge-proof/cpu/runtime-sha256.json',
}
try:
    output={}
    for key,name in FILES.items():
        p=pathlib.Path(name)
        if p.is_symlink() or not p.is_file() or p.stat().st_size>2*1024*1024:raise ValueError('bounded_regular_image_file_required')
        output[key]=base64.b64encode(p.read_bytes()).decode()
    print(json.dumps({'scope':'LOCAL_TEST_NOT_DEPLOYABLE','files':output},separators=(',',':')))
except BaseException:
    sys.stderr.write('LOCAL_TEST_IMAGE_EXTRACTION_FAILED\n');sys.exit(1)
