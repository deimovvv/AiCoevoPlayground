#!/usr/bin/env python3
"""
Extracción one-shot: adelgazar generations.json
────────────────────────────────────────────────
Saca del índice los dos tipos de carga pesada y los deja en archivos:

  1. pipelineState  → data/pipeline_states/<gen_id>.json
                      (en el índice queda "hasPipelineState": true)
  2. base64 embebido en thumbnailUrl / outputUrl
                    → data/renders/extracted/<gen_id>_<campo>.<ext>
                      (en el índice queda la ruta /static/renders/extracted/...)

Idempotente: correrlo de nuevo no duplica ni rompe nada.
Hace backup del índice ANTES de tocar nada.

Uso — con el server FRENADO:
    ./.venv/bin/python scripts/split_generations.py --dry-run   # ver qué haría
    ./.venv/bin/python scripts/split_generations.py             # hacerlo
"""

import argparse
import base64
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services import generations as G  # noqa: E402

EXTRACTED_DIR = G.DATA_DIR / "renders" / "extracted"
DATA_URL_RE = re.compile(r"^data:([\w.+-]+)/([\w.+-]+);base64,(.*)$", re.S)

# subtipo del mime → extensión de archivo
_EXT = {"jpeg": "jpg", "svg+xml": "svg", "quicktime": "mov", "x-m4a": "m4a"}


def _mb(n: int) -> str:
    return f"{n / 1_048_576:.1f} MB"


def _extract_data_url(gen_id: str, field: str, value: str, dry: bool):
    """data:image/png;base64,... → archivo en disco + ruta /static. None si no aplica."""
    m = DATA_URL_RE.match(value)
    if not m:
        return None
    _, subtype, payload = m.groups()
    ext = _EXT.get(subtype.lower(), subtype.lower())
    safe_id = "".join(c for c in gen_id if c.isalnum() or c in "-_")
    fname = f"{safe_id}_{field}.{ext}"
    if not dry:
        EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
        (EXTRACTED_DIR / fname).write_bytes(base64.b64decode(payload))
    return f"/static/renders/extracted/{fname}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="mostrar sin escribir")
    args = ap.parse_args()
    dry = args.dry_run

    if not G.GENERATIONS_FILE.exists():
        print("No hay generations.json — nada que hacer.")
        return 0

    size_before = G.GENERATIONS_FILE.stat().st_size
    print(f"{'[DRY RUN] ' if dry else ''}Leyendo {G.GENERATIONS_FILE.name} ({_mb(size_before)})...")

    with open(G.GENERATIONS_FILE, "r", encoding="utf-8") as f:
        gens = json.load(f)
    total = len(gens)
    print(f"  {total} registros\n")

    # Backup ANTES de tocar nada. Este archivo es el rollback.
    backup_path = None
    if not dry:
        G.BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        backup_path = G.BACKUPS_DIR / f"generations-pre-split-{ts}.json"
        shutil.copy2(G.GENERATIONS_FILE, backup_path)
        print(f"  Backup → backups/{backup_path.name}\n")

    n_states = n_states_skip = n_urls = 0
    bytes_states = bytes_urls = 0

    for gen in gens:
        gen_id = gen.get("id") or ""
        if not gen_id:
            continue

        # 1. pipelineState → archivo aparte
        state = gen.pop("pipelineState", None)
        if state:
            bytes_states += len(json.dumps(state, ensure_ascii=False))
            if not dry:
                G.write_pipeline_state(gen_id, state)
            gen["hasPipelineState"] = True
            n_states += 1
        elif gen.get("hasPipelineState") or (not dry and G.has_pipeline_state(gen_id)):
            # Ya migrado en una corrida anterior — se respeta el flag (idempotencia).
            gen["hasPipelineState"] = True
            n_states_skip += 1
        else:
            gen.pop("hasPipelineState", None)

        # 2. base64 embebido en las URLs → archivo aparte
        for field in ("thumbnailUrl", "outputUrl"):
            value = gen.get(field)
            if not isinstance(value, str) or not value.startswith("data:"):
                continue
            new_url = _extract_data_url(gen_id, field, value, dry)
            if new_url:
                bytes_urls += len(value)
                gen[field] = new_url
                n_urls += 1

    if dry:
        remaining = len(json.dumps(gens, ensure_ascii=False, indent=2).encode())
        print("Haría:")
        print(f"  pipelineState extraídos ....... {n_states} archivos ({_mb(bytes_states)})")
        print(f"  ya migrados de antes .......... {n_states_skip}")
        print(f"  base64 extraídos .............. {n_urls} archivos ({_mb(bytes_urls)})")
        print(f"\n  índice: {_mb(size_before)} → ~{_mb(remaining)}")
        print("\n(dry run — no se escribió nada)")
        return 0

    # Escritura atómica del índice nuevo
    G._atomic_write_json(G.GENERATIONS_FILE, gens)
    size_after = G.GENERATIONS_FILE.stat().st_size

    # Chequeo de integridad: el índice nuevo tiene que releerse y tener los mismos registros
    with open(G.GENERATIONS_FILE, "r", encoding="utf-8") as f:
        reread = json.load(f)
    ok = len(reread) == total
    n_state_files = len(list(G.PIPELINE_STATES_DIR.glob("*.json")))

    print("Hecho:")
    print(f"  pipelineState extraídos ....... {n_states} archivos ({_mb(bytes_states)})")
    print(f"  ya migrados de antes .......... {n_states_skip}")
    print(f"  base64 extraídos .............. {n_urls} archivos ({_mb(bytes_urls)})")
    print(f"  archivos en pipeline_states/ .. {n_state_files}")
    print(f"\n  índice: {_mb(size_before)} → {_mb(size_after)}  "
          f"({100 - size_after * 100 // size_before}% más chico)")
    print(f"  registros: {total} → {len(reread)}  {'OK' if ok else '¡NO COINCIDEN!'}")
    if backup_path:
        print(f"\n  Rollback: cp {backup_path} {G.GENERATIONS_FILE}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
