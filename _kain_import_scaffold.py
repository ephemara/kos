import json, os, re, subprocess, sys
from pathlib import Path

root = Path(r"M:\K_OS")
kain_exe = Path(r"M:\Code\Kain\target\release\kain.exe")
target_root = root / "kain"
target_root.mkdir(parents=True, exist_ok=True)

crates = sorted([p for p in (root / "crates").iterdir() if p.is_dir()], key=lambda p: p.name.lower())


def neutral_name(name: str) -> str:
    n = name
    n = re.sub(r"^k-os-", "", n)
    n = re.sub(r"^zen-", "", n)
    n = re.sub(r"[^a-zA-Z0-9]+", "_", n).strip("_").lower()
    return n or "module"

rows = []
for crate in crates:
    neutral = neutral_name(crate.name)
    target_dir = target_root / neutral
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / f"{neutral}.kn"
    import_input = None
    for candidate in [crate / "src", crate / "src" / "lib.rs", crate / "src" / "main.rs"]:
        if candidate.exists():
            import_input = candidate
            break

    status = "stub"
    notes = ""
    if import_input:
        report = target_dir / "import_report.json"
        cmd = [str(kain_exe), "import-rust", str(import_input), "--output", str(target_file), "--flat", "--report-json", str(report)]
        proc = subprocess.run(cmd, cwd=str(root), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if proc.returncode == 0 and target_file.exists():
            status = "imported"
            notes = f"Imported from {import_input.name}"
        else:
            status = "failed"
            notes = (proc.stdout or "").strip()[:2000]
            if not target_file.exists():
                target_file.write_text(f"# Stub scaffold for {crate.name}\n\nSource: {import_input}\nStatus: import failed; scaffold placeholder created.\n", encoding="utf-8")
    else:
        status = "stub"
        notes = "No Rust source entrypoint found."
        target_file.write_text(f"# Stub scaffold for {crate.name}\n\nSource: none found\nStatus: placeholder only.\n", encoding="utf-8")

    if not target_file.exists():
        target_file.write_text(f"# Stub scaffold for {crate.name}\n\nSource: {import_input if import_input else 'none'}\nStatus: placeholder only.\n", encoding="utf-8")

    rows.append({
        "source_crate": crate.name,
        "target_kain_path": str(Path("kain") / neutral / f"{neutral}.kn").replace("\\", "/"),
        "import_status": status,
        "notes": notes,
    })

summary_md = ["# Kain Rust Import Summary", "", "| source crate | target kain path | import status | notes |", "|---|---|---|---|"]
for row in rows:
    notes = row["notes"].replace("|", "\\|")
    summary_md.append(f"| {row['source_crate']} | {row['target_kain_path']} | {row['import_status']} | {notes} |")
(target_root / "IMPORT_SUMMARY.md").write_text("\n".join(summary_md) + "\n", encoding="utf-8")
(target_root / "IMPORT_SUMMARY.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(f"done: {len(rows)} crates")
