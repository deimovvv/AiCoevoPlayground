"""
Generations Persistence Service
────────────────────────────────
El índice (generations.json) guarda SOLO lo liviano: lo que la biblioteca necesita
para pintar una card. El pipelineState —que llegó a ser el 87% de un archivo de
462 MB— vive en un archivo por generación bajo data/pipeline_states/ y se lee
únicamente cuando alguien abre esa generación puntual.

Toda escritura es atómica (tmp + os.replace) y ocurre bajo un lock de archivo
(flock). flock lo maneja el sistema operativo, así que funciona ENTRE PROCESOS:
es lo que permite correr varios workers de uvicorn sin corromper el índice.

Para cambiar algo usá siempre mutate(): lee y escribe bajo el mismo lock, de modo
que dos guardados simultáneos no se pisen el cambio.
"""

import fcntl
import json
import os
import shutil
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = Path(__file__).parent.parent / "data"
GENERATIONS_FILE = DATA_DIR / "generations.json"
PIPELINE_STATES_DIR = DATA_DIR / "pipeline_states"
BACKUPS_DIR = DATA_DIR / "backups"
LOCK_FILE = DATA_DIR / ".generations.lock"

_MAX_BACKUPS = 20
# El índice se guarda en cada paso del pipeline (auto-save). Copiarlo entero cada
# vez sería puro churn, así que el backup se hace como mucho una vez por hora.
_BACKUP_MIN_INTERVAL_S = 3600

DATA_DIR.mkdir(exist_ok=True)
PIPELINE_STATES_DIR.mkdir(exist_ok=True)
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


# ── Primitivas de escritura segura ────────────────────────────────────────────

@contextmanager
def _file_lock():
    """Lock exclusivo entre procesos. A diferencia de threading.Lock (que solo
    cubre un proceso), flock sirve con varios workers de uvicorn."""
    with open(LOCK_FILE, "w") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _atomic_write_json(path: Path, payload: Any) -> None:
    """Escribe a un .tmp y recién ahí lo mueve encima del original. os.replace es
    atómico en POSIX: el archivo final es el viejo o el nuevo, nunca uno a medias.
    Sin esto, un corte durante el guardado deja el índice roto."""
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def _newest_backup() -> Optional[Path]:
    backups = sorted(BACKUPS_DIR.glob("generations-*.json"))
    return backups[-1] if backups else None


def _backup_if_stale() -> None:
    """Copia el índice actual a backups/ con timestamp, rotando los últimos N.
    Best-effort: nunca rompe el guardado."""
    try:
        if not GENERATIONS_FILE.exists() or GENERATIONS_FILE.stat().st_size < 10:
            return
        newest = _newest_backup()
        if newest and (time.time() - newest.stat().st_mtime) < _BACKUP_MIN_INTERVAL_S:
            return
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        shutil.copy2(GENERATIONS_FILE, BACKUPS_DIR / f"generations-{ts}.json")
        for old in sorted(BACKUPS_DIR.glob("generations-*.json"))[:-_MAX_BACKUPS]:
            old.unlink(missing_ok=True)
    except Exception as e:
        print(f"[generations] backup falló (se sigue igual): {e}")


def _read_unlocked() -> List[dict]:
    if not GENERATIONS_FILE.exists():
        return []
    try:
        with open(GENERATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        # Índice ilegible. Devolver [] sería peor que el error: el próximo guardado
        # pisaría la biblioteca entera con una lista vacía. Recuperamos del backup
        # más reciente, igual que hace brands.py.
        print(f"[generations] ERROR leyendo el índice: {e}")
        newest = _newest_backup()
        if newest:
            print(f"[generations] recuperando de {newest.name}")
            with open(newest, "r", encoding="utf-8") as f:
                return json.load(f)
        raise


# ── API pública ───────────────────────────────────────────────────────────────

def load_generations() -> List[dict]:
    """Lee el índice liviano. NO trae pipelineState — para eso está with_pipeline_state()."""
    with _file_lock():
        return _read_unlocked()


def save_generations(gens: List[dict]) -> None:
    """Reemplaza el índice entero. Preferí mutate() salvo que ya tengas la lista completa."""
    with _file_lock():
        _backup_if_stale()
        _atomic_write_json(GENERATIONS_FILE, gens)


@contextmanager
def mutate():
    """Lee y guarda bajo un mismo lock.

        with generations.mutate() as gens:
            gens.append(nuevo)

    Esto es lo que evita el 'lost update': sin el lock sostenido, dos requests
    leen la misma lista, cada una agrega lo suyo, y la segunda en escribir borra
    el cambio de la primera. Si el bloque lanza una excepción, no se escribe nada.

    OJO: hay que modificar la lista EN EL LUGAR (append, gens[i] = ..., gens[:] = ...).
    Si la reasignás (gens = [...]) se guarda la lista vieja, porque lo que se escribe
    es el objeto que se entregó acá.
    """
    with _file_lock():
        gens = _read_unlocked()
        yield gens
        _backup_if_stale()
        _atomic_write_json(GENERATIONS_FILE, gens)


# ── pipelineState: un archivo por generación ──────────────────────────────────

def _state_path(gen_id: str) -> Path:
    # El id llega desde la URL, así que se sanitiza: sin esto un id con ../ podría
    # escribir fuera de la carpeta.
    safe = "".join(c for c in str(gen_id) if c.isalnum() or c in "-_")
    return PIPELINE_STATES_DIR / f"{safe}.json"


def read_pipeline_state(gen_id: str) -> Optional[dict]:
    path = _state_path(gen_id)
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"[generations] pipelineState ilegible para {gen_id}: {e}")
        return None


def write_pipeline_state(gen_id: str, state: Optional[dict]) -> bool:
    """Guarda el estado del pipeline. Devuelve True si quedó algo guardado."""
    if not state:
        delete_pipeline_state(gen_id)
        return False
    _atomic_write_json(_state_path(gen_id), state)
    return True


def delete_pipeline_state(gen_id: str) -> None:
    _state_path(gen_id).unlink(missing_ok=True)


def has_pipeline_state(gen_id: str) -> bool:
    return _state_path(gen_id).exists()


def with_pipeline_state(gen: dict) -> dict:
    """Copia del registro con el pipelineState hidratado desde disco.
    Solo para el endpoint de detalle — listar NUNCA debe llamar a esto."""
    full = dict(gen)
    state = read_pipeline_state(gen.get("id", ""))
    if state is not None:
        full["pipelineState"] = state
    return full
