"""
Primitivas de step — envuelven los service calls que YA existen como nodos `execute`.

Fase 0: cero comportamiento nuevo. Cada nodo es un wrapper delgado sobre un service
(`image_gen`, `kling_video`, `tts`, `fal_lipsync`, `video_concat`, `prompt_builder`).
No están cableados a ninguna tool todavía — es solo el catálogo de primitivas del que
el motor (Fase 1) y el renderer (Fase 2) van a componer.

Grain = un step con sentido (una call a Fal, un prompt assembly), no una op por nodo.
"""

from __future__ import annotations

import asyncio

from services import image_gen, kling_video, tts, fal_lipsync, video_concat, prompt_builder

from .types import NodeDescriptor, NodeContext, Port, ParamSpec, PortType, ParamType
from .registry import register


# ── Helpers de polling (submit → poll → result) ────────────────────────────────
# Los nodos async-job comparten el patrón: create_* devuelve request_id, get_status
# hasta "completed", get_result para la URL final. Un poller genérico evita duplicarlo.
async def _poll(mod, request_id: str, *, tries: int = 120, delay: float = 4.0) -> dict:
    for _ in range(tries):
        st = await mod.get_status(request_id)
        status = st.get("status")
        if status == "completed":
            return await mod.get_result(request_id)
        if status == "failed":
            raise RuntimeError(st.get("error") or "job failed")
        await asyncio.sleep(delay)
    raise TimeoutError("job timed out")


# ── prompt_assemble ────────────────────────────────────────────────────────────
# PromptBuilder de 3 capas como nodo: toma BRAND_CONTEXT + tool_id/vars → emite PROMPT.
async def _run_prompt_assemble(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    brand = inputs.get("brand_context") or ctx.brand or {}
    prompt = prompt_builder.build_prompt(params["tool_id"], brand, params.get("extra_variables"))
    return {"prompt": prompt or ""}


register(NodeDescriptor(
    type="prompt_assemble",
    label="Prompt Assemble",
    category="prompt",
    description="Ensambla el prompt final (3 capas: tool default → brand override → vars dinámicas).",
    inputs=[Port("brand_context", PortType.BRAND_CONTEXT, required=False, description="Contexto de marca; si falta usa ctx.brand")],
    outputs=[Port("prompt", PortType.PROMPT)],
    params=[
        ParamSpec("tool_id", ParamType.STRING, label="Tool ID", description="Qué template resolver"),
        ParamSpec("extra_variables", ParamType.MULTILINE, label="Vars extra (JSON)", default=None, description="Overrides de variables"),
    ],
    execute=_run_prompt_assemble,
))


# ── nano_image (text-to-image) ─────────────────────────────────────────────────
async def _run_nano_image(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    req = await image_gen.create_text_to_image(
        inputs["prompt"], params.get("aspect_ratio", "1:1"), params.get("resolution", "2K"), params.get("num_images", 1),
    )
    res = await _poll(image_gen, req)
    return {"image": res.get("image_url"), "images": [i["url"] for i in res.get("images", []) if i.get("url")]}


register(NodeDescriptor(
    type="nano_image",
    label="Nano Image (text→image)",
    category="image",
    description="Genera imagen desde un prompt (Nano Banana 2, sin refs).",
    inputs=[Port("prompt", PortType.PROMPT)],
    outputs=[Port("image", PortType.IMAGE), Port("images", PortType.IMAGE_LIST)],
    params=[
        ParamSpec("aspect_ratio", ParamType.ENUM, label="Aspect ratio", default="1:1", options=["1:1", "4:5", "3:4", "9:16", "16:9"]),
        ParamSpec("resolution", ParamType.ENUM, label="Resolución", default="2K", options=["1K", "2K", "4K"]),
        ParamSpec("num_images", ParamType.INT, label="Cantidad", default=1, min=1, max=4),
    ],
    execute=_run_nano_image,
))


# ── nano_image_edit (multi-ref composition / edit) ─────────────────────────────
async def _run_nano_image_edit(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    req = await image_gen.create_edit(
        inputs["images"], inputs["prompt"], params.get("aspect_ratio", "9:16"), params.get("resolution", "1K"), params.get("num_images", 1),
    )
    res = await _poll(image_gen, req)
    return {"image": res.get("image_url"), "images": [i["url"] for i in res.get("images", []) if i.get("url")]}


register(NodeDescriptor(
    type="nano_image_edit",
    label="Nano Image Edit (refs→image)",
    category="image",
    description="Compone/edita imagen a partir de referencias (avatar/producto/escena) + prompt.",
    inputs=[Port("images", PortType.IMAGE_LIST), Port("prompt", PortType.PROMPT)],
    outputs=[Port("image", PortType.IMAGE), Port("images", PortType.IMAGE_LIST)],
    params=[
        ParamSpec("aspect_ratio", ParamType.ENUM, label="Aspect ratio", default="9:16", options=["1:1", "4:5", "3:4", "9:16", "16:9"]),
        ParamSpec("resolution", ParamType.ENUM, label="Resolución", default="1K", options=["1K", "2K", "4K"]),
        ParamSpec("num_images", ParamType.INT, label="Cantidad", default=1, min=1, max=4),
    ],
    execute=_run_nano_image_edit,
))


# ── kling_video (image→video) ──────────────────────────────────────────────────
async def _run_kling_video(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    req = await kling_video.create_video(
        inputs["image"], inputs.get("prompt"), params.get("duration", "5"),
        aspect_ratio=params.get("aspect_ratio", "9:16"), model=params.get("model", "v3-pro"),
        end_image_url=inputs.get("end_image"),
    )
    res = await _poll(kling_video, req)
    return {"video": res.get("video_url")}


register(NodeDescriptor(
    type="kling_video",
    label="Kling Video (image→video)",
    category="video",
    description="Anima una imagen (o frame→frame con end_image) con Kling.",
    inputs=[
        Port("image", PortType.IMAGE, description="Frame inicial"),
        Port("prompt", PortType.TEXT, required=False, description="Motion prompt"),
        Port("end_image", PortType.IMAGE, required=False, description="Frame final (frame-to-frame)"),
    ],
    outputs=[Port("video", PortType.VIDEO)],
    params=[
        ParamSpec("duration", ParamType.ENUM, label="Duración (s)", default="5", options=["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]),
        ParamSpec("aspect_ratio", ParamType.ENUM, label="Aspect ratio", default="9:16", options=["1:1", "9:16", "16:9"]),
        ParamSpec("model", ParamType.ENUM, label="Modelo", default="v3-pro", options=["v3-pro", "v2-6-pro"]),
    ],
    execute=_run_kling_video,
))


# ── voice_tts (text→audio) ─────────────────────────────────────────────────────
async def _run_voice_tts(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    # generate_audio es síncrono (SDK ElevenLabs) → lo corremos en thread para no bloquear.
    audio_bytes = await asyncio.to_thread(
        tts.generate_audio, inputs["text"], params.get("voice_id"), params.get("model_id", "eleven_v3"),
        "mp3_44100_128", params.get("stability", 0.5), params.get("similarity_boost", 0.8),
        params.get("style", 0.0), params.get("speaker_boost", True), params.get("speed", 1.0),
    )
    return {"audio": audio_bytes}


register(NodeDescriptor(
    type="voice_tts",
    label="Voice TTS (text→audio)",
    category="audio",
    description="Text-to-speech con ElevenLabs. Emite bytes de audio (MP3).",
    inputs=[Port("text", PortType.TEXT)],
    outputs=[Port("audio", PortType.AUDIO)],
    params=[
        ParamSpec("voice_id", ParamType.STRING, label="Voice ID", default=None),
        ParamSpec("model_id", ParamType.STRING, label="Modelo", default="eleven_v3"),
        ParamSpec("stability", ParamType.FLOAT, label="Stability", default=0.5, min=0.0, max=1.0),
        ParamSpec("similarity_boost", ParamType.FLOAT, label="Similarity", default=0.8, min=0.0, max=1.0),
        ParamSpec("style", ParamType.FLOAT, label="Style", default=0.0, min=0.0, max=1.0),
        ParamSpec("speed", ParamType.FLOAT, label="Speed", default=1.0, min=0.7, max=1.2),
        ParamSpec("speaker_boost", ParamType.BOOL, label="Speaker boost", default=True),
    ],
    execute=_run_voice_tts,
))


# ── fal_lipsync (video + audio → video) ────────────────────────────────────────
async def _run_fal_lipsync(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    req = await fal_lipsync.create_lipsync(inputs["video"], inputs["audio"], params.get("sync_mode", "cut_off"))
    res = await _poll(fal_lipsync, req)
    return {"video": res.get("video_url")}


register(NodeDescriptor(
    type="fal_lipsync",
    label="Fal Lip-Sync",
    category="video",
    description="Sincroniza labios de un video con un audio (Fal Fabric).",
    inputs=[Port("video", PortType.VIDEO), Port("audio", PortType.AUDIO)],
    outputs=[Port("video", PortType.VIDEO)],
    params=[ParamSpec("sync_mode", ParamType.ENUM, label="Sync mode", default="cut_off", options=["cut_off", "loop", "bounce"])],
    execute=_run_fal_lipsync,
))


# ── video_concat (videos → video) ──────────────────────────────────────────────
async def _run_video_concat(inputs: dict, params: dict, ctx: NodeContext) -> dict:
    res = await video_concat.concat_videos(
        inputs["videos"], scripts=inputs.get("scripts"),
        add_subtitles=params.get("add_subtitles", True), subtitle_engine=params.get("subtitle_engine", "auto"),
    )
    return {"video": res.get("video_url"), "duration": res.get("duration")}


register(NodeDescriptor(
    type="video_concat",
    label="Video Concat (FFmpeg)",
    category="video",
    description="Concatena segmentos de video y opcionalmente quema subtítulos.",
    inputs=[Port("videos", PortType.VIDEO_LIST), Port("scripts", PortType.ANY, required=False, description="Texto por segmento para subtítulos")],
    outputs=[Port("video", PortType.VIDEO)],
    params=[
        ParamSpec("add_subtitles", ParamType.BOOL, label="Subtítulos", default=True),
        ParamSpec("subtitle_engine", ParamType.ENUM, label="Motor subs", default="auto", options=["auto", "remotion", "ffmpeg", "none"]),
    ],
    execute=_run_video_concat,
))
