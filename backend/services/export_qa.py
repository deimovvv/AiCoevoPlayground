"""
Revisión automática del export del editor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Revisar cuadros del inicio, el medio y el final y corregir lo que tape la cara o se
salga de cuadro" (guía de edición, openspec/changes/archive/2026-10-09-shared-video-editor/design.md §4).
Acá se hace sin IA y sin costo, por cada texto del video:

1. Dónde quedó el texto: se compara el cuadro EXPORTADO con el mismo cuadro del video
   SIN textos. Los píxeles que cambian son el texto (y su sombra).
2. Dónde está la cara: YuNet (OpenCV, modelo MIT de 230 KB en backend/models/) sobre el
   cuadro sin texto. Se probó contra Haar, que marcaba caras en el jean.
3. Avisos: el texto tapa la cara · toca un borde (quedó cortado) · cae en la franja de
   abajo donde Reels/TikTok ponen botones y caption.

Cada aviso trae una miniatura con las dos cajas dibujadas, para verlo de un vistazo.
"""

import asyncio
import uuid
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np

DATA_DIR = Path(__file__).parent.parent / "data"
RENDERS_DIR = DATA_DIR / "renders"
MODEL = Path(__file__).parent.parent / "models" / "face_detection_yunet_2023mar.onnx"
LOCAL_BASE = "http://127.0.0.1:8000"
UNSAFE_BOTTOM = 0.24     # franja de abajo con UI de Reels/TikTok (igual que TextLayer)
EDGE = 0.012             # a menos de 1,2 % del borde = cortado


def _abs(url: str) -> str:
    return f"{LOCAL_BASE}{url}" if url.startswith("/static/") else url


def is_configured() -> bool:
    return MODEL.exists()


async def _frame(url: str, t: float) -> Optional[np.ndarray]:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-v", "error", "-ss", f"{max(0.0, t):.3f}", "-i", _abs(url),
        "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-",
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0 or not out:
        return None
    return cv2.imdecode(np.frombuffer(out, np.uint8), cv2.IMREAD_COLOR)


def _faces(img: np.ndarray) -> List[tuple]:
    h, w = img.shape[:2]
    det = cv2.FaceDetectorYN.create(str(MODEL), "", (w, h), 0.7, 0.3, 5000)
    _, found = det.detect(img)
    if found is None:
        return []
    out = []
    for f in found:
        x, y, fw, fh = (int(v) for v in f[:4])
        # Margen: el pelo y la frente también son "la cara" para un texto encima.
        mx, my = int(fw * 0.15), int(fh * 0.2)
        out.append((max(0, x - mx), max(0, y - my), min(w, x + fw + mx), min(h, y + fh + my)))
    return out


# Franja de cada posición (fracción del alto): cada texto se busca sólo en la suya. Así dos
# textos en pantalla a la vez (título arriba, prenda abajo) no se mezclan en una caja.
BANDS = {"top": (0.0, 0.45), "center": (0.25, 0.75), "bottom": (0.45, 1.0)}


def _text_box(with_text: np.ndarray, bases: List[np.ndarray], position: str) -> Optional[tuple]:
    """Caja del texto: lo que cambió entre el export y el video sin textos.

    Se compara contra el MÍNIMO de varios cuadros vecinos de la fuente: el clip va a 24
    cuadros/s y el export a 30, así que un mismo segundo no es exactamente el mismo
    cuadro, y el movimiento de la modelo aparecía como "texto".
    """
    h, w = with_text.shape[:2]
    g = cv2.cvtColor(with_text, cv2.COLOR_BGR2GRAY).astype(np.int16)
    diffs = []
    for b in bases:
        if b.shape[:2] != (h, w):
            b = cv2.resize(b, (w, h))
        diffs.append(np.abs(g - cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.int16)))
    diff = np.min(diffs, axis=0)
    mask = (diff > 40).astype(np.uint8) * 255
    lo, hi = BANDS.get(position, (0.0, 1.0))
    mask[: int(h * lo)] = 0
    mask[int(h * hi):] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    boxes = [stats[i] for i in range(1, n) if stats[i][4] > (w * h) * 0.0004]
    if not boxes:
        return None
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes); y1 = max(b[1] + b[3] for b in boxes)
    return (int(x0), int(y0), int(x1), int(y1))


def _overlap(a: tuple, b: tuple) -> float:
    """Fracción de la cara (b) tapada por el texto (a)."""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area = (b[2] - b[0]) * (b[3] - b[1])
    return (ix * iy) / area if area else 0.0


def _thumb(img: np.ndarray, text: Optional[tuple], faces: List[tuple], out_dir: Optional[Path] = None) -> str:
    vis = img.copy()
    h, w = vis.shape[:2]
    lw = max(2, w // 300)
    for f in faces:
        cv2.rectangle(vis, f[:2], f[2:], (80, 200, 255), lw)
    if text:
        cv2.rectangle(vis, text[:2], text[2:], (120, 95, 255), lw)
    cv2.line(vis, (0, int(h * (1 - UNSAFE_BOTTOM))), (w, int(h * (1 - UNSAFE_BOTTOM))), (160, 160, 160), max(1, lw // 2))
    scale = 360 / w
    vis = cv2.resize(vis, (360, int(h * scale)), interpolation=cv2.INTER_AREA)
    name = f"qa_{uuid.uuid4().hex[:8]}.jpg"
    if out_dir:   # proyectos del editor: la miniatura queda en su carpeta
        out_dir.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out_dir / name), vis, [cv2.IMWRITE_JPEG_QUALITY, 82])
        return str(out_dir / name)
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(RENDERS_DIR / name), vis, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return f"/static/renders/{name}"


async def review_export(final_url: str, base_url: str, texts: List[dict], thumbs_dir: Optional[Path] = None) -> dict:
    """Revisa cada texto del export. `texts`: PlacedText (id, text, start, end, position).

    Devuelve {"checked": n, "issues": [{textId, text, t, kinds, message, thumbUrl}]}.
    """
    if not is_configured():
        raise RuntimeError("Falta el modelo de caras (backend/models/face_detection_yunet_2023mar.onnx)")
    issues = []
    for tx in texts:
        start, end = float(tx["start"]), float(tx["end"])
        # Después de la entrada (0,35 s), cuando el texto ya está nítido y quieto.
        t = min(start + 0.6, (start + end) / 2)
        a, *near = await asyncio.gather(_frame(final_url, t), *[_frame(base_url, t + d) for d in (-0.042, 0, 0.042)])
        bases = [x for x in near if x is not None]
        if a is None or not bases:
            continue
        b = bases[len(bases) // 2]
        h, w = a.shape[:2]
        box = _text_box(a, bases, tx.get("position", ""))
        if not box:
            continue
        faces = _faces(b)
        kinds, msgs = [], []
        covered = max((_overlap(box, f) for f in faces), default=0.0)
        if covered > 0.08:
            kinds.append("face"); msgs.append(f"tapa la cara ({round(covered * 100)} %)")
        if box[0] <= w * EDGE or box[2] >= w * (1 - EDGE) or box[1] <= h * EDGE or box[3] >= h * (1 - EDGE):
            kinds.append("edge"); msgs.append("toca el borde del cuadro (puede verse cortado)")
        # Margen de 2 %: "Abajo" se apoya justo en el límite y la sombra lo pasa apenas.
        if box[3] > h * (1 - UNSAFE_BOTTOM + 0.02):
            kinds.append("unsafe"); msgs.append("cae donde Reels/TikTok ponen botones y caption")
        if kinds:
            issues.append({
                "textId": tx.get("id"), "text": tx.get("text", ""), "t": round(t, 2), "kinds": kinds,
                "message": "; ".join(msgs).capitalize() + ".", "thumbUrl": _thumb(a, box, faces, thumbs_dir),
            })
    return {"checked": len(texts), "issues": issues}
