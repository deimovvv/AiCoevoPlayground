"""
Música del editor de video
━━━━━━━━━━━━━━━━━━━━━━━━━━
La pista de música está atada al video ENTERO (no a un clip): se ajusta al largo final en
cada export. Tres cosas:

- `save_upload`: un tema subido por el operador → data/music/ (servido en /static/music/).
- `mix_music`: mezcla la música en el video ya editado — desde qué segundo del tema arranca,
  volumen, fade de entrada corto y fade de salida al final, en loop si el tema es más corto.
  Si el video tiene voz, la música baja sola debajo (sidechain, igual que video_concat).
- `detect_beats`: los golpes del tema (numpy, sin librosa), en tiempo del VIDEO, para
  "ajustar los cortes al ritmo".
"""

import asyncio
import uuid
from pathlib import Path
from typing import List, Optional

import numpy as np

DATA_DIR = Path(__file__).parent.parent / "data"
MUSIC_DIR = DATA_DIR / "music"
RENDERS_DIR = DATA_DIR / "renders"
LOCAL_BASE = "http://127.0.0.1:8000"
ALLOWED_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}


def get_music_dir() -> Path:
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    return MUSIC_DIR


def _abs(url: str) -> str:
    return f"{LOCAL_BASE}{url}" if url.startswith("/static/") else url


async def _run(*args: str) -> bytes:
    proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(err.decode()[-400:])
    return out


async def _duration(url: str) -> float:
    out = await _run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url)
    return float(out.decode().strip())


async def _has_audio(url: str) -> bool:
    out = await _run("ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", url)
    return bool(out.decode().strip())


def save_upload(data: bytes, filename: str) -> dict:
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise ValueError(f"Formato no soportado ({ext or 'sin extensión'}). Usá mp3, wav, m4a, aac, ogg o flac.")
    name = f"music_{uuid.uuid4().hex[:8]}{ext}"
    (get_music_dir() / name).write_bytes(data)
    return {"url": f"/static/music/{name}", "name": Path(filename).stem[:60]}


async def mix_music(
    video_url: str,
    music_url: str,
    start: float = 0.0,
    volume: float = 0.6,
    fade_out: float = 1.5,
    out_path: Optional[Path] = None,
) -> dict:
    """Devuelve {"video_url": "/static/renders/...", "duration": s}; con `out_path`, "path"."""
    video, music = _abs(video_url), _abs(music_url)
    dur = await _duration(video)
    vol = max(0.0, min(1.5, volume))
    fo = max(0.0, min(fade_out, dur / 2))
    # Tema desde `start`, en loop si es más corto, recortado al largo del video, con un
    # fade de entrada mínimo (evita el clic) y el de salida al final.
    mus = (
        f"[1:a]volume={vol:.3f},afade=t=in:st=0:d=0.25"
        + (f",afade=t=out:st={dur - fo:.3f}:d={fo:.3f}" if fo > 0 else "")
        + f",atrim=0:{dur:.3f}[mus]"
    )
    if await _has_audio(video):
        fc = (mus + ";[mus][0:a]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=300[duck];"
              "[0:a][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]")
    else:
        fc = mus.replace("[mus]", "[a]")
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    out = out_path or RENDERS_DIR / f"music_{uuid.uuid4().hex[:8]}.mp4"
    await _run(
        "ffmpeg", "-y", "-v", "error", "-i", video,
        "-stream_loop", "-1", "-ss", f"{max(0.0, start):.3f}", "-i", music,
        "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{dur:.3f}",
        "-movflags", "+faststart", str(out),
    )
    if out_path:
        return {"path": str(out), "duration": round(dur, 2)}
    return {"video_url": f"/static/renders/{out.name}", "duration": round(dur, 2)}


async def detect_beats(music_url: str, start: float = 0.0, length: Optional[float] = None) -> dict:
    """Golpes del tema desde `start`, en segundos del VIDEO (0 = donde arranca la música).

    Método: envolvente de energía por bandas → flujo espectral (subidas de energía) →
    tempo por autocorrelación (70–180 BPM) → la grilla de golpes que mejor calza con los
    picos. Sin librosa: numpy alcanza para música con pulso (la de moda lo tiene).
    """
    sr, hop = 22050, 512
    args = ["ffmpeg", "-v", "error", "-ss", f"{max(0.0, start):.3f}", "-i", _abs(music_url)]
    if length:
        args += ["-t", f"{length + 1:.3f}"]
    args += ["-ac", "1", "-ar", str(sr), "-f", "f32le", "-"]
    pcm = np.frombuffer(await _run(*args), dtype=np.float32)
    if pcm.size < sr * 2:
        return {"bpm": None, "beats": []}

    n_fft = 2048
    frames = 1 + (pcm.size - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(pcm[idx] * np.hanning(n_fft), axis=1))
    logspec = np.log1p(spec * 10)
    flux = np.maximum(0, np.diff(logspec, axis=0)).sum(axis=1)
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    fps = sr / hop

    # Segundo de cada valor del flujo. El ataque se nota recién cuando la ventana entera
    # (n_fft) lo contiene: medido con temas sintéticos de 120 y 130 BPM, el retardo es n_fft.
    t_of = lambda k: k * hop / sr + n_fft / sr

    # 1. Tempo aproximado: autocorrelación del flujo, entre 70 y 180 BPM.
    ac = np.correlate(flux, flux, mode="full")[flux.size - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
    lag = lo + int(np.argmax(ac[lo:hi]))

    # 2. Golpes reales: picos del flujo (máximos locales fuertes, separados ≥ 40 % del período).
    thr = flux.mean() + flux.std()
    cand = [k for k in range(1, flux.size - 1) if flux[k] > thr and flux[k] >= flux[k - 1] and flux[k] >= flux[k + 1]]
    onsets: List[int] = []
    for k in cand:
        if onsets and k - onsets[-1] < 0.4 * lag:
            if flux[k] > flux[onsets[-1]]:
                onsets[-1] = k
            continue
        onsets.append(k)
    on_t = np.array([t_of(k) for k in onsets])
    if on_t.size < 3:
        return {"bpm": None, "beats": [round(float(t), 3) for t in on_t]}

    # 3. Período y fase finos: a cada pico se le asigna su número de golpe y se ajusta
    #    t = fase + n · período por mínimos cuadrados. Promedia el redondeo a cuadros
    #    (las distancias sueltas caen en 21 ó 22 cuadros y hacían derivar la grilla).
    approx = lag / fps
    # Numerar cada pico respecto del ANTERIOR (no del primero): un período aproximado
    # apenas corrido desfasaba la numeración a lo largo del tema.
    n = np.concatenate([[0], np.cumsum(np.maximum(1, np.round(np.diff(on_t) / approx)))])
    period, phase = np.polyfit(n, on_t, 1)
    for _ in range(2):   # re-asignar con el período ya afinado
        n = np.round((on_t - phase) / period)
        period, phase = np.polyfit(n, on_t, 1)
    period, phase = float(period), float(phase % period)
    total_t = t_of(flux.size)
    beats = [round(float(phase + k * period), 3) for k in range(int((total_t - phase) / period) + 1)]
    if length:
        beats = [b for b in beats if b <= length]
    return {"bpm": round(60 / period, 1), "beats": beats}
