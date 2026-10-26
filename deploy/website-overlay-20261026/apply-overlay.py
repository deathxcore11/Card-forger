#!/usr/bin/env python3
"""Verify every baseline and overlay before restoring unpublished website changes."""
import hashlib
import json
import pathlib
import sys

package = pathlib.Path(__file__).resolve().parent
target = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None
if target is None or not target.is_dir():
    raise SystemExit('Usage: python3 apply-overlay.py /absolute/path/to/production-checkout')
manifest = json.loads((package / 'overlay-manifest.json').read_text())
pending = []
for entry in manifest['files']:
    relative = pathlib.PurePosixPath(entry['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise SystemExit('Unsafe overlay path')
    destination = target.joinpath(*relative.parts)
    if not destination.resolve().is_relative_to(target):
        raise SystemExit('Destination escaped checkout')
    data = (package / 'ui-overlay').joinpath(*relative.parts).read_bytes()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise SystemExit('Overlay checksum mismatch: ' + str(relative))
    old = destination.read_bytes() if destination.exists() else None
    current = None if old is None else hashlib.sha1(b'blob ' + str(len(old)).encode() + b'\0' + old).hexdigest()
    if current != entry['baselineGitSha']:
        raise SystemExit('Baseline mismatch, no files changed: ' + str(relative))
    pending.append((destination, data))
for destination, data in pending:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
print(f'Restored {len(pending)} unpublished files; nothing committed, pushed or deployed.')
print('Separately restore deploy/forge-host from add03f7; do not merge its root proof configuration.')
