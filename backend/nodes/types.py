"""
Node model — Fase 0 de la arquitectura de nodos (ver docs/architecture-nodes.md).

Descriptor de nodo como DATO puro (serializable) + una fn `execute` separada — el split
de n8n. Los ports son TIPADOS (vocabulario chico, estilo ComfyUI) para que un renderer
genérico pueda validar el wiring sin código por-tool. Los params se declaran como schema
para que la UI se genere sola (Fase 2), matando los `tool.id === "..."`.

Esta fase NO cambia comportamiento: solo cataloga primitivas envolviendo los service
calls que ya existen. El motor que corre grafos es Fase 1.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Optional


class PortType(str, Enum):
    """Vocabulario tipado de ports. Chico y estricto a propósito (lección de ComfyUI):
    tipos fuertes = el renderer valida conexiones sin código a medida."""
    IMAGE = "IMAGE"
    IMAGE_LIST = "IMAGE[]"
    VIDEO = "VIDEO"
    VIDEO_LIST = "VIDEO[]"
    AUDIO = "AUDIO"
    TEXT = "TEXT"
    PROMPT = "PROMPT"
    BRAND_CONTEXT = "BRAND_CONTEXT"
    ANY = "ANY"


class ParamType(str, Enum):
    """Tipo de control de un parámetro → el form renderer genérico dibuja el widget."""
    STRING = "string"
    MULTILINE = "multiline"
    INT = "int"
    FLOAT = "float"
    BOOL = "bool"
    ENUM = "enum"
    UPLOAD = "upload"


@dataclass
class Port:
    name: str
    type: PortType
    required: bool = True
    description: str = ""

    def to_dict(self) -> dict:
        return {"name": self.name, "type": self.type.value, "required": self.required, "description": self.description}


@dataclass
class ParamSpec:
    name: str
    type: ParamType
    label: str = ""
    default: Any = None
    min: Optional[float] = None
    max: Optional[float] = None
    options: list = field(default_factory=list)
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name, "type": self.type.value, "label": self.label or self.name,
            "default": self.default, "min": self.min, "max": self.max,
            "options": list(self.options), "description": self.description,
        }


@dataclass
class NodeContext:
    """Contexto inyectado en cada `execute`. En Fase 0 lleva el brand (para PromptAssemble
    y resolución de assets). Fase 1 sumará caché de outputs, logger, cancel token, etc."""
    brand: dict = field(default_factory=dict)


# execute(inputs, params, ctx) -> outputs. Keys = nombres de los output ports.
ExecuteFn = Callable[[dict, dict, "NodeContext"], Awaitable[dict]]


@dataclass
class NodeDescriptor:
    """Una primitiva de step. `type` es la key en el NODE_REGISTRY. El descriptor es data
    pura (serializable a JSON/DSL) EXCEPTO `execute`, que vive solo en el backend."""
    type: str
    label: str
    category: str
    inputs: list[Port]
    outputs: list[Port]
    params: list[ParamSpec]
    execute: ExecuteFn
    description: str = ""

    def to_dict(self) -> dict:
        """Descriptor serializable (sin la fn) — para el catálogo que consume el front / el DSL."""
        return {
            "type": self.type,
            "label": self.label,
            "category": self.category,
            "description": self.description,
            "inputs": [p.to_dict() for p in self.inputs],
            "outputs": [p.to_dict() for p in self.outputs],
            "params": [p.to_dict() for p in self.params],
        }
