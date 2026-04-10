#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KAIN_BIN="${KAIN_BIN_PATH:-/home/ephemara/Dev/Kain/target/release/kain}"

if [[ ! -x "$KAIN_BIN" ]]; then
  echo "Kain compiler not found or not executable: $KAIN_BIN" >&2
  echo "Set KAIN_BIN_PATH to a valid kain binary and rerun." >&2
  exit 1
fi

python - <<'PY' "$ROOT_DIR" "$KAIN_BIN"
import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
kain_bin = Path(sys.argv[2])
manifest_path = root / "crates/k-os-kain/manifests/sources.json"
items = json.loads(manifest_path.read_text())
spirv_items = [item for item in items if item.get("target") == "spirv"]

print(f"regenerating {len(spirv_items)} spirv assets from {manifest_path}")

for item in spirv_items:
    source_path = root / item["source_path"]
    output_path = root / item["compiled_path"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[spirv] {item['id']}")
    subprocess.run(
        [str(kain_bin), "build", str(source_path), "-t", "spirv", "-o", str(output_path)],
        cwd=root,
        check=True,
    )

print("done")
PY
