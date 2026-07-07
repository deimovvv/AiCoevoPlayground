"""
Motor de grafos — Fase 1 (ver docs/architecture-nodes.md).

Deserializa un grafo (JSON) → topological sort → corre cada nodo pasando los outputs
tipados de los upstream por los edges. Ejecuta en el BACKEND (siempre), como todos los
motores serios (n8n/ComfyUI/Langflow).

Killer feature (de ComfyUI): **caché por hash de nodo** → en un re-run, los nodos cuyo
(type + params + inputs) no cambió devuelven su output cacheado y NO se re-ejecutan. Es la
nativización de nuestra filosofía "curá el multishot antes de animar": tocás un nodo y solo
re-corre ese nodo y sus descendientes.

Formato del grafo:
    {
      "nodes": [
        {"id": "n1", "type": "prompt_assemble", "params": {"tool_id": "..."}, "inputs": {}},
        {"id": "n2", "type": "nano_image", "params": {"aspect_ratio": "4:5"},
         "inputs": {"prompt": {"node": "n1", "port": "prompt"}}}
      ],
      "output": "n2"   // opcional; default = último en orden topológico
    }
Un input puede ser un REF a un output upstream ({"node","port"}) o un VALOR estático.
"""

from __future__ import annotations

import hashlib
import json

from .types import NodeContext
from .registry import get_node


class GraphError(Exception):
    """Error de estructura del grafo (ref colgada, ciclo, tipo desconocido)."""


def _topo_sort(nodes: dict) -> list:
    """Kahn simple (O(n²), suficiente para grafos de tools). Detecta refs colgadas y ciclos."""
    deps: dict = {nid: set() for nid in nodes}
    for nid, n in nodes.items():
        for wiring in (n.get("inputs") or {}).values():
            if isinstance(wiring, dict) and "node" in wiring:
                dep = wiring["node"]
                if dep not in nodes:
                    raise GraphError(f"nodo '{nid}' referencia un nodo inexistente: '{dep}'")
                deps[nid].add(dep)

    order: list = []
    resolved: set = set()
    while len(resolved) < len(nodes):
        progressed = False
        for nid in nodes:
            if nid in resolved:
                continue
            if deps[nid] <= resolved:
                order.append(nid)
                resolved.add(nid)
                progressed = True
        if not progressed:
            restantes = [nid for nid in nodes if nid not in resolved]
            raise GraphError(f"el grafo tiene un ciclo (nodos sin resolver: {restantes})")
    return order


def _hash_default(o):
    if isinstance(o, (bytes, bytearray)):
        return "bytes:" + hashlib.sha256(bytes(o)).hexdigest()
    return str(o)


def _hash_node(type_: str, params: dict, inputs: dict) -> str:
    """Hash estable de (type + params + inputs resueltos) → cache key del nodo."""
    payload = {"type": type_, "params": params, "inputs": inputs}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=_hash_default).encode()).hexdigest()


async def run_graph(graph: dict, ctx: NodeContext | None = None, cache: dict | None = None) -> dict:
    """Corre un grafo y devuelve outputs por nodo + un trace (qué se cacheó vs. re-corrió).

    Pasá el MISMO `cache` (dict) entre runs para el skip-por-hash: los nodos sin cambios
    devuelven cacheado. Sin cache → se ejecuta todo.
    """
    ctx = ctx or NodeContext()
    cache = cache if cache is not None else {}

    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    if not nodes:
        raise GraphError("grafo vacío")

    order = _topo_sort(nodes)
    results: dict = {}   # node_id -> outputs dict
    trace: list = []

    for nid in order:
        n = nodes[nid]
        desc = get_node(n["type"])
        if desc is None:
            raise GraphError(f"tipo de nodo desconocido: '{n['type']}' (nodo '{nid}')")

        # Resolver inputs: ref a output upstream, o valor estático.
        inputs: dict = {}
        for port, wiring in (n.get("inputs") or {}).items():
            if isinstance(wiring, dict) and "node" in wiring:
                src = results.get(wiring["node"], {})
                inputs[port] = src.get(wiring.get("port"))
            else:
                inputs[port] = wiring

        params = n.get("params") or {}
        h = _hash_node(n["type"], params, inputs)
        if h in cache:
            outputs = cache[h]
            cached = True
        else:
            outputs = await desc.execute(inputs, params, ctx)
            cache[h] = outputs
            cached = False

        results[nid] = outputs
        trace.append({"id": nid, "type": n["type"], "cached": cached, "outputs": list(outputs.keys())})

    output_id = graph.get("output") or order[-1]
    return {
        "output_node": output_id,
        "output": results.get(output_id),
        "order": order,
        "trace": trace,
        "results": results,
    }
