"""
Segmentación interactiva — SAM 2 vía Fal.
─────────────────────────────────────────
Dado una imagen y un PUNTO, devuelve la máscara del objeto que hay en ese punto.
Es lo que permite "tocás el televisor y se selecciona solo" en vez de pintarlo
a mano con el pincel.

Contrato con el front (`MaskCanvas`):
  · entra:  image_url + {x, y} en coordenadas de la IMAGEN ORIGINAL
  · sale:   PNG en escala de grises — BLANCO = el objeto, NEGRO = el resto

⚠️ Ese formato es el INVERSO del que espera `mask_url` de GPT Image 2, donde la
zona editable va TRANSPARENTE. La conversión la hace el front al componer la
máscara final, que es donde además se combinan varias selecciones.

Costo: cada consulta es una llamada paga. Por eso se segmenta al CLICK y no al
hover — mover el mouse dispararía decenas de llamadas por segundo.
"""
import os
import httpx

FAL_KEY = os.getenv("FAL_KEY")
FAL_MODEL = "fal-ai/sam2/image"
QUEUE = "https://queue.fal.run"


def is_configured() -> bool:
    return bool(FAL_KEY)


def _headers() -> dict:
    return {"Authorization": f"Key {FAL_KEY}", "Content-Type": "application/json"}


async def segment_at_point(image_url: str, x: int, y: int) -> str:
    """
    Segmenta el objeto que está en (x, y) y devuelve la URL de la máscara.

    x, y van en píxeles de la imagen ORIGINAL — si el front la muestra escalada,
    tiene que convertir las coordenadas antes de llamar.

    Lanza si Fal falla: el front decide si cae al pincel manual o avisa.
    """
    if not is_configured():
        raise RuntimeError("FAL_KEY no configurada")

    payload = {
        "image_url": image_url,
        # label 1 = foreground. El 0 sería "esto NO es parte del objeto", útil
        # para refinar una selección; por ahora se manda un solo punto positivo.
        "prompts": [{"x": int(x), "y": int(y), "label": 1}],
    }

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(f"{QUEUE}/{FAL_MODEL}", headers=_headers(), json=payload)
        if r.status_code not in (200, 201):
            raise Exception(f"SAM2 error ({r.status_code}): {r.text[:200]}")
        data = r.json()
        # OJO: el endpoint devuelve status_url/response_url SIN el sufijo de la
        # ruta. Armarlas a mano da 405 — hay que usar las que vienen acá.
        status_url, response_url = data["status_url"], data["response_url"]

        for _ in range(60):  # ~2 min de techo
            import asyncio
            await asyncio.sleep(2)
            s = await client.get(status_url, headers=_headers())
            if s.status_code != 200:
                continue
            st = s.json().get("status")
            if st == "COMPLETED":
                break
            if st in ("FAILED", "ERROR"):
                raise Exception(f"SAM2 falló: {s.text[:200]}")
        else:
            raise Exception("SAM2 timeout")

        res = await client.get(response_url, headers=_headers())
        image = (res.json() or {}).get("image") or {}
        url = image.get("url")
        if not url:
            raise Exception(f"SAM2 no devolvió máscara: {res.text[:200]}")
        return url
