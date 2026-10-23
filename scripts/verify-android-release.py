"""Fail-closed coordinated release gate; never builds, signs or publishes.

Requires the established signed APK, apksigner and apkanalyzer. A bundle-only
check is diagnostic and intentionally cannot produce release approval.
"""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import zipfile

EXPECTED_PACKAGE = 'com.cardstashy.app'
EXPECTED_CERT = 'e6e401a61b7b1b9a525ba06ff69e7eb76b7ed3c4a9a8831c61f1564eaadc3f55'

def node(source, code):
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], cwd=source, text=True))

def release_record(source):
    return node(source, "import {RELEASE} from './release-record.js'; console.log(JSON.stringify(RELEASE))")

def normalized(path, data):
    # Existing native entry appends display-only version text to this constant.
    if path == 'config.js':
        data = re.sub(rb'(APP_VERSION\s*=\s*[\"\'][^\"\']+?)\s+\xc2\xb7 Android [^\"\']+', rb'\1', data)
    # The APK cannot contain its own SHA-256/size. These two fields are filled
    # after signing. All versions, notes, IDs and download path must still match.
    if path == 'release-record.js':
        data = re.sub(rb"sha256\s*:\s*['\"][^'\"]*['\"]", b"sha256:'ARTIFACT'", data)
        data = re.sub(rb'bytes\s*:\s*\d+', b'bytes:0', data)
    return data

def native_expected(source, shared):
    adapted=set(node(source, "import {NATIVE_ADAPTED} from './scripts/android-native/bundle.mjs'; console.log(JSON.stringify(NATIVE_ADAPTED))"))
    paths=sorted(p for p in shared if p in adapted or p.endswith('.css'))
    return json.loads(subprocess.check_output(['node','scripts/android-native/bundle.mjs'],cwd=source,text=True,input=json.dumps(paths))) if paths else {}

def bundle_check(source, apk, record):
    errors=[]
    shared=set(node(source, "import {moduleGraph} from './scripts/module-graph.mjs'; console.log(JSON.stringify(moduleGraph()))"))
    shell=(source/'sw.js').read_text().split('const ASSETS = [',1)[1].split('];',1)[0]
    shared.update(re.findall(r'[\"\']\./([^\"\']+)[\"\']',shell))
    # Native transport imports this policy directly; the browser app does not.
    # A stale copy silently blocks otherwise valid services such as update checks.
    shared.add('native-service-policy.js')
    # index, manifest, entry and service worker are native-shell-specific. The
    # actual app modules, CSS, foil assets, icons and artwork must match.
    shared.difference_update({'','index.html','manifest.json','sw.js'})
    shared={p for p in shared if not p.endswith('.apk') and (source/p).is_file()}
    # A few files are adapted by the reviewed native transforms (scripts/android-native/bundle.mjs);
    # the APK must hold exactly those transforms of the source, and every other file byte for byte.
    expected=native_expected(source, shared)
    with zipfile.ZipFile(apk) as archive:
        for name in sorted(shared):
            try: actual=archive.read('assets/public/'+name)
            except KeyError: errors.append('APK missing shared asset: '+name);continue
            if name in expected: ok=hashlib.sha256(actual).hexdigest()==expected[name]
            else: ok=normalized(name,actual)==normalized(name,(source/name).read_bytes())
            if not ok: errors.append('APK differs from shared source: '+name)
    current=node(source, "import {APP_VERSION} from './config.js'; console.log(JSON.stringify(APP_VERSION))").split(' · ')[0]
    if record['webVersion']!=current or record['android']['interfaceVersion']!=current:
        errors.append('Website, published release and bundled interface versions must match.')
    return {'sharedAssetsChecked':len(shared),'errors':errors}

def verify(source,apk,signer,analyzer):
    record=release_record(source);a=record['android'];report=bundle_check(source,apk,record)
    raw=apk.read_bytes()
    if len(raw)!=a['bytes'] or hashlib.sha256(raw).hexdigest()!=a['sha256']:report['errors'].append('APK size/checksum differs from release record.')
    for tool in [signer,analyzer]:
        if not shutil.which(tool):report['errors'].append('Required Android verification tool unavailable: '+tool)
    if report['errors']: return report
    signature=subprocess.run([signer,'verify','--verbose','--print-certs',str(apk)],capture_output=True,text=True)
    cert=re.search(r'Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9:]+)',signature.stdout)
    if signature.returncode or not cert or cert[1].replace(':','').lower()!=EXPECTED_CERT:report['errors'].append('APK signature does not match the established update certificate.')
    for field,expected in [('application-id',EXPECTED_PACKAGE),('version-code',str(a['versionCode'])),('version-name',a['versionName'])]:
        actual=subprocess.check_output([analyzer,'manifest',field,str(apk)],text=True).strip()
        if actual!=expected:report['errors'].append('Android manifest mismatch: '+field)
    if a['package']!=EXPECTED_PACKAGE:report['errors'].append('Release package identity changed.')
    report['artifactSha256']=hashlib.sha256(raw).hexdigest()
    report['websiteVersion']=record['webVersion'];report['androidVersion']=a['versionName']
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=pathlib.Path,default=pathlib.Path('.'));p.add_argument('--apk',type=pathlib.Path,required=True);p.add_argument('--apksigner',default='apksigner');p.add_argument('--apkanalyzer',default='apkanalyzer');p.add_argument('--bundle-only',action='store_true');args=p.parse_args()
    source=args.source.resolve();apk=args.apk.resolve()
    report=bundle_check(source,apk,release_record(source)) if args.bundle_only else verify(source,apk,args.apksigner,args.apkanalyzer)
    report['releaseApproved']=not args.bundle_only and not report['errors'];report['physicalDeviceTested']=False
    print(json.dumps(report,indent=2))
    return 1 if report['errors'] else 0
if __name__=='__main__':sys.exit(main())
