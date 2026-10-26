#!/usr/bin/env python3
"""Construct a minimal context from byte-verified frozen checkpoint files.

Usage: python3 prepare_context.py CHECKPOINT_ROOT NEW_CONTEXT_DIRECTORY
Does not clone, build, deploy, read credentials, or copy runtime files.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys

HERE = Path(__file__).resolve().parent


def prepare(source: Path, destination: Path):
    manifest = json.loads((HERE / "checkpoint-files.json").read_text())
    verified = []
    for name, expected in manifest["sha256"].items():
        path = source / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Missing or symlinked frozen input: {name}")
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f"Frozen checkpoint mismatch: {name}")
        verified.append((name, data))
    destination.mkdir(parents=True, exist_ok=False)
    for name, data in verified:
        target = destination / "native" / Path(name).relative_to("experiments/forge-proof/native")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    for name in ["Dockerfile", "assemble.sh", "gateway.py", "checkpoint-files.json"]:
        target = destination / (name if name == "Dockerfile" else "hosting/" + name)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(HERE / name, target)
    (destination / ".dockerignore").write_text(
        "**\n!Dockerfile\n!hosting/\n!hosting/**\n!native/\n!native/**\n"
    )
    return manifest


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    result = prepare(Path(sys.argv[1]), Path(sys.argv[2]))
    print("Prepared frozen HOST-001 context:", result["checkpoint"])
