"""
Sistema de nodos — Fase 0 (modelo + registry). Ver docs/architecture-nodes.md.

Importar este paquete registra todas las primitivas (side-effect de importar `primitives`).
Cero cambio de comportamiento en las tools actuales: es solo el catálogo del que Fase 1
(motor de grafos) y Fase 2 (renderer schema-driven) van a componer.
"""

from .types import (
    PortType, ParamType, Port, ParamSpec, NodeContext, NodeDescriptor, ExecuteFn,
)
from .registry import NODE_REGISTRY, register, get_node, list_nodes
from .engine import run_graph, GraphError
from . import primitives  # noqa: F401 — registra las primitivas al importar

__all__ = [
    "PortType", "ParamType", "Port", "ParamSpec", "NodeContext", "NodeDescriptor", "ExecuteFn",
    "NODE_REGISTRY", "register", "get_node", "list_nodes", "primitives",
    "run_graph", "GraphError",
]
