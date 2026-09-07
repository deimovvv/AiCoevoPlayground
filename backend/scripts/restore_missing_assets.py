#!/usr/bin/env python3
"""
Recuperar assets de marca que quedaron colgados
────────────────────────────────────────────────
El commit 9596e9b ("sacar backend/data/ de git → data local") sacó los archivos
del repo, pero brands.json siguió apuntando a ellos. Resultado: 46 de 242 assets
(19%) referenciaban archivos que ya no estaban en disco, y la UI mostraba
imágenes rotas — Taller Santa Clara tenía los 26 rotos.

Este script busca en brands.json qué imágenes faltan y las recupera del commit
anterior al borrado. Idempotente: si no falta nada, no hace nada.

    ./.venv/bin/python scripts/restore_missing_assets.py --dry-run
    ./.venv/bin/python scripts/restore_missing_assets.py
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
REPO = BACKEND.parent
# Último commit que todavía tenía los archivos versionados.
SOURCE_REF = "9596e9b^"

DIRS = {
    "avatars": "avatars", "products": "products", "clothing": "clothing",
    "backgrounds": "backgrounds", "moodboards": "moodboards",
    "lookAndFeel": "lookandfeel", "poses": "poses",
}


def find_missing():
    brands = json.loads((BACKEND / "data" / "brands.json").read_text(encoding="utf-8"))
    out = []
    for b in brands:
        for key, folder in DIRS.items():
            for item in (b.get(key) or []):
                url = item.get("imageUrl")
                if not url:
                    continue
                path = BACKEND / "data" / folder / os.path.basename(url)
                if not path.exists():
                    out.append((b.get("name") or "?", path))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    missing = find_missing()
    if not missing:
        print("No falta ningún asset — nada que hacer.")
        return 0

    print(f"Faltan {len(missing)} archivos.\n")
    ok = fail = 0
    for brand, path in missing:
        rel = path.relative_to(REPO).as_posix()
        if args.dry_run:
            print(f"  recuperaría  {rel}  ({brand})")
            continue
        try:
            blob = subprocess.run(
                ["git", "show", f"{SOURCE_REF}:{rel}"],
                capture_output=True, check=True, cwd=REPO,
            ).stdout
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(blob)
            ok += 1
        except subprocess.CalledProcessError:
            fail += 1
            print(f"  NO está en git: {rel}  ({brand})")

    if args.dry_run:
        print("\n(dry run — no se escribió nada)")
        return 0

    print(f"\nrecuperados: {ok}   irrecuperables: {fail}")
    if fail:
        print("Los irrecuperables hay que volver a subirlos desde la marca.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
