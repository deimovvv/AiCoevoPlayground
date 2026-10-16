"""
Trabajos de fondo (infra-v1).

En producción Cloudflare corta los pedidos que tardan más de ~100 s. Los pasos largos (pegar
clips, grabar textos, mezclar música, exportar un proyecto, revisar el export) corren como
trabajo: el pedido responde enseguida con un id, y el navegador pregunta cada 1–2 s.

En memoria del proceso: alcanza con un solo proceso de uvicorn (el VPS). Si un día hay varios
procesos o máquinas, esto pasa a la base o a una cola.
"""
import asyncio
import time
import uuid
from typing import Awaitable, Dict, Optional

from fastapi import HTTPException

_JOBS: Dict[str, dict] = {}
_TASKS: Dict[str, asyncio.Task] = {}
_TTL = 6 * 3600   # un resultado se guarda 6 h


def _cleanup() -> None:
    now = time.time()
    for jid in [j for j, v in _JOBS.items() if now - v["created"] > _TTL]:
        _JOBS.pop(jid, None)
        _TASKS.pop(jid, None)


async def _run(jid: str, coro: Awaitable) -> None:
    try:
        _JOBS[jid]["result"] = await coro
        _JOBS[jid]["status"] = "done"
    except HTTPException as e:
        _JOBS[jid].update(status="error", error=str(e.detail), code=e.status_code)
    except Exception as e:  # noqa: BLE001 — el error vuelve al navegador
        _JOBS[jid].update(status="error", error=str(e), code=502)
    finally:
        _JOBS[jid]["finished"] = time.time()


def start(kind: str, coro: Awaitable) -> str:
    _cleanup()
    jid = f"job_{uuid.uuid4().hex[:12]}"
    _JOBS[jid] = {"id": jid, "kind": kind, "status": "running", "created": time.time()}
    _TASKS[jid] = asyncio.create_task(_run(jid, coro))
    return jid


def get(jid: str) -> Optional[dict]:
    j = _JOBS.get(jid)
    if not j:
        return None
    out = {k: j[k] for k in ("id", "kind", "status") if k in j}
    out["elapsed"] = round((j.get("finished") or time.time()) - j["created"], 1)
    if j["status"] == "done":
        out["result"] = j.get("result")
    elif j["status"] == "error":
        out.update(error=j.get("error"), code=j.get("code"))
    return out
