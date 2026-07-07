"""
NODE_REGISTRY — el punto de extensión del sistema de nodos.

Sumar una primitiva = registrar un descriptor acá, NUNCA parchear un motor (anti-pattern
de Dify: set de nodos fijo). Fase 1 (el runner) y Fase 2 (el renderer) leen de este registry.
"""

from __future__ import annotations

from .types import NodeDescriptor

NODE_REGISTRY: dict[str, NodeDescriptor] = {}


def register(desc: NodeDescriptor) -> NodeDescriptor:
    """Registra una primitiva. Falla fuerte ante duplicados para no pisar nodos por error."""
    if desc.type in NODE_REGISTRY:
        raise ValueError(f"node type '{desc.type}' ya está registrado")
    NODE_REGISTRY[desc.type] = desc
    return desc


def get_node(type_: str) -> NodeDescriptor | None:
    return NODE_REGISTRY.get(type_)


def list_nodes() -> list[dict]:
    """Catálogo serializable (data pura, sin `execute`) — lo consumirá el front / el DSL."""
    return [d.to_dict() for d in NODE_REGISTRY.values()]
