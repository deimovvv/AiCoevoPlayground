"""
Un PDF de marca (manual, moodboard, referencias, todo junto) → páginas como imágenes + su texto.
Lo usa la Bandeja (routers/inbox.py): cada página entra como una imagen más del envío y el agente
(services/inbox_agent.py) propone qué es y adónde va; el texto sirve para leer la identidad.
"""
from pathlib import Path
from typing import List, Tuple

MAX_PAGES = 40
LONG_SIDE = 1400   # px del lado largo de cada página: alcanza para verla y para el agente


def split(pdf: Path, out_dir: Path, prefix: str) -> Tuple[List[dict], str]:
    """Devuelve ([{filename, page}], texto). Hasta MAX_PAGES páginas; las demás se ignoran (se avisa en el nombre)."""
    import fitz  # PyMuPDF

    pages: List[dict] = []
    texts: List[str] = []
    with fitz.open(str(pdf)) as doc:
        for i, page in enumerate(doc):
            if i >= MAX_PAGES:
                break
            r = page.rect
            zoom = LONG_SIDE / max(r.width, r.height, 1)
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            name = f"{prefix}_p{i + 1:02d}.jpg"
            pix.save(str(out_dir / name), jpg_quality=85)
            pages.append({"filename": name, "page": i + 1})
            t = page.get_text().strip()
            if t:
                texts.append(f"[página {i + 1}]\n{t}")
        total = doc.page_count
    text = "\n\n".join(texts)
    if total > MAX_PAGES:
        text += f"\n\n[el PDF tiene {total} páginas; se leyeron las primeras {MAX_PAGES}]"
    return pages, text[:30000]
