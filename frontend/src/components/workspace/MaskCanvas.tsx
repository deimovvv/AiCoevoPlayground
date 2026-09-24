import { useEffect, useRef, useState, useCallback } from "react";
import { Eraser, Undo2, Trash2, Wand2, Brush as BrushIcon, Loader2, SquareDashed } from "lucide-react";
import { segmentAtPoint } from "../../lib/api";
import { cn } from "../../lib/utils";

/**
 * MaskCanvas — pintar QUÉ parte de una imagen se quiere cambiar.
 * ───────────────────────────────────────────────────────────────
 * El usuario pinta con el mouse sobre la imagen y el componente devuelve una
 * MÁSCARA: un PNG del mismo tamaño donde lo pintado queda TRANSPARENTE y el
 * resto opaco. Ese es el formato que espera `mask_url` de GPT Image 2 — la zona
 * transparente es la editable.
 *
 * Por qué GPT Image y no Nano Banana: Nano Banana 2 **no acepta máscara**
 * (verificado 2026-09-21 contra su API). Sin máscara, pedir "cambiá solo el
 * televisor" obliga al modelo a redibujar la imagen entera y cambia cosas que
 * nadie pidió — el failure mode documentado en la skill `generar-imagenes`.
 *
 * Dos capas de canvas:
 *   - `viewRef`  → lo que se VE mientras pintás (trazo rosa semitransparente)
 *   - `maskRef`  → lo que se MANDA (blanco opaco con agujeros transparentes)
 * Se pintan en paralelo para no tener que convertir una en otra al exportar.
 *
 * El brush manual es el piso. La segmentación automática (click sobre un objeto
 * y que se seleccione solo) se apoya sobre esto: produce la misma máscara por
 * otro camino. Ver docs/pending-features.md §14.
 */

interface Props {
    imageUrl: string;
    /** Devuelve la máscara como data URL PNG, o null si no se pintó nada. */
    onMaskChange: (maskDataUrl: string | null) => void;
    className?: string;
}

export function MaskCanvas({ imageUrl, onMaskChange, className }: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<HTMLCanvasElement>(null);
    const maskRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [brush, setBrush] = useState(40);
    const [dirty, setDirty] = useState(false);
    /** Tamaño renderizado de la imagen. El canvas se ancla a esto, no al wrapper. */
    const [box, setBox] = useState({ w: 0, h: 0 });
    /** Tamaño que ENTRA en el área disponible, calculado a mano (ver el render). */
    const [fit, setFit] = useState({ w: 0, h: 0 });
    /** Alto reservado para la barra flotante de controles + el hint. */
    const CHROME_H = 92;
    /** `brush` = pintás a mano · `wand` = tocás un objeto y se selecciona solo (SAM 2). */
    const [mode, setMode] = useState<"brush" | "wand" | "box">("box");
    const [segmenting, setSegmenting] = useState(false);
    /** Último error de segmentación. Se muestra: antes sólo iba a consola y
     *  "tocabas el objeto y no pasaba nada" sin explicación. */
    const [segError, setSegError] = useState<string | null>(null);
    /** Rectángulo en curso (modo caja). `null` cuando no se está arrastrando. */
    const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
    /** Snapshots para deshacer. Se guarda el par (vista, máscara) por trazo. */
    const history = useRef<Array<{ view: ImageData; mask: ImageData }>>([]);

    /** Dimensiona los canvas al tamaño REAL de la imagen renderizada. */
    const sync = useCallback(() => {
        const img = wrapRef.current?.querySelector("img");
        const view = viewRef.current, mask = maskRef.current;
        const host = wrapRef.current?.parentElement;
        if (!img || !view || !mask || !host || !img.naturalWidth) return;

        // Cuánto espacio hay, descontando padding y la barra de controles.
        const availW = host.clientWidth - 48;
        const availH = host.clientHeight - CHROME_H;
        if (availW <= 0 || availH <= 0) return;
        const ratio = img.naturalWidth / img.naturalHeight;
        let fw = availW, fh = fw / ratio;
        if (fh > availH) { fh = availH; fw = fh * ratio; }
        setFit({ w: Math.round(fw), h: Math.round(fh) });

        const w = Math.round(fw), h = Math.round(fh);
        if (view.width === w && view.height === h) return;
        [view, mask].forEach((c) => { c.width = w; c.height = h; });
        setBox({ w, h });
        // La máscara arranca OPACA: sin pintar nada, no hay zona editable.
        const mctx = mask.getContext("2d");
        if (mctx) { mctx.fillStyle = "#fff"; mctx.fillRect(0, 0, w, h); }
    }, []);

    useEffect(() => {
        sync();
        const ro = new ResizeObserver(sync);
        // Se observa el CONTENEDOR: es el que define cuánto espacio hay, y de ahí
        // sale el tamaño de la imagen (ver `sync`). Observar la imagen sería
        // circular — su tamaño lo fija el propio cálculo.
        const host = wrapRef.current?.parentElement;
        if (host) ro.observe(host);
        window.addEventListener("resize", sync);
        return () => { ro.disconnect(); window.removeEventListener("resize", sync); };
    }, [sync, imageUrl]);

    const pos = (e: React.PointerEvent) => {
        const r = viewRef.current!.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const snapshot = () => {
        const v = viewRef.current?.getContext("2d");
        const m = maskRef.current?.getContext("2d");
        if (!v || !m || !viewRef.current) return;
        history.current.push({
            view: v.getImageData(0, 0, viewRef.current.width, viewRef.current.height),
            mask: m.getImageData(0, 0, viewRef.current.width, viewRef.current.height),
        });
        // Tope de 20 pasos: cada snapshot es un bitmap completo y la memoria sube rápido.
        if (history.current.length > 20) history.current.shift();
    };

    const stroke = (x: number, y: number) => {
        const v = viewRef.current?.getContext("2d");
        const m = maskRef.current?.getContext("2d");
        if (!v || !m) return;
        // Vista: trazo rosa (el color de señal del sistema).
        v.globalCompositeOperation = "source-over";
        v.fillStyle = "rgba(255,95,143,.45)";
        v.beginPath(); v.arc(x, y, brush / 2, 0, Math.PI * 2); v.fill();
        // Máscara: AGUJERO. `destination-out` borra en vez de pintar, que es
        // justo lo que necesita GPT Image (transparente = editable).
        m.globalCompositeOperation = "destination-out";
        m.beginPath(); m.arc(x, y, brush / 2, 0, Math.PI * 2); m.fill();
    };

    /**
     * Selecciona el objeto que hay bajo el click, con SAM 2.
     *
     * Las coordenadas van en píxeles de la imagen ORIGINAL: el canvas trabaja
     * sobre la versión escalada, así que se convierten con la relación entre
     * `naturalWidth` y el ancho renderizado.
     *
     * La máscara de SAM viene con el objeto en BLANCO; acá se dibuja invertida
     * (agujero) porque es lo que espera `mask_url` de GPT Image.
     */
    const wandAt = async (cx: number, cy: number) => {
        const img = wrapRef.current?.querySelector("img");
        const v = viewRef.current?.getContext("2d");
        const m = maskRef.current?.getContext("2d");
        if (!img || !v || !m || segmenting) return;
        const scale = img.naturalWidth / (box.w || img.clientWidth);
        setSegmenting(true);
        setSegError(null);
        try {
            const maskUrl = await segmentAtPoint(imageUrl, cx * scale, cy * scale);
            const seg = new Image();
            seg.crossOrigin = "anonymous";
            await new Promise<void>((ok, fail) => {
                seg.onload = () => ok();
                seg.onerror = () => fail(new Error("no se pudo cargar la máscara"));
                seg.src = maskUrl;
            });
            snapshot();
            // Vista: el objeto en rosa. `destination-out` sobre un buffer no sirve
            // acá, así que se pinta con la máscara como recorte.
            const tmp = document.createElement("canvas");
            tmp.width = box.w; tmp.height = box.h;
            const t = tmp.getContext("2d")!;
            t.drawImage(seg, 0, 0, box.w, box.h);
            t.globalCompositeOperation = "source-in";
            t.fillStyle = "rgba(255,95,143,.45)";
            t.fillRect(0, 0, box.w, box.h);
            v.globalCompositeOperation = "source-over";
            v.drawImage(tmp, 0, 0);
            // Máscara: agujero donde SAM marcó blanco.
            m.globalCompositeOperation = "destination-out";
            m.drawImage(seg, 0, 0, box.w, box.h);
            setDirty(true);
            onMaskChange(maskRef.current!.toDataURL("image/png"));
        } catch (e) {
            console.error("[mask] segmentación falló:", e);
            const msg = e instanceof Error ? e.message : "No se pudo seleccionar el objeto";
            // El error de saldo agotado es el más común y el más confuso: se
            // traduce a algo accionable en vez de mostrar el crudo de Fal.
            setSegError(
                /balance|locked/i.test(msg)
                    ? "Sin saldo en Fal — cargá crédito en fal.ai/dashboard/billing. Mientras tanto podés usar el pincel."
                    : msg,
            );
        } finally {
            setSegmenting(false);
        }
    };

    /** Convierte el rectángulo arrastrado en máscara. No pasa por SAM: es
     *  inmediato, gratis, y alcanza para la mayoría de las correcciones. */
    const applyRect = (r: { x0: number; y0: number; x1: number; y1: number }) => {
        const v = viewRef.current?.getContext("2d");
        const m = maskRef.current?.getContext("2d");
        if (!v || !m) return;
        const x = Math.min(r.x0, r.x1), y = Math.min(r.y0, r.y1);
        const w = Math.abs(r.x1 - r.x0), h = Math.abs(r.y1 - r.y0);
        if (w < 6 || h < 6) return; // un click suelto no es una selección
        snapshot();
        v.globalCompositeOperation = "source-over";
        v.fillStyle = "rgba(255,95,143,.45)";
        v.fillRect(x, y, w, h);
        m.globalCompositeOperation = "destination-out";
        m.fillRect(x, y, w, h);
        setDirty(true);
        onMaskChange(maskRef.current!.toDataURL("image/png"));
    };

    const emit = () => {
        const mask = maskRef.current;
        if (!mask || !dirty) { onMaskChange(null); return; }
        onMaskChange(mask.toDataURL("image/png"));
    };

    const onDown = (e: React.PointerEvent) => {
        const { x, y } = pos(e);
        if (mode === "wand") { void wandAt(x, y); return; }
        if (mode === "box") {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            setRect({ x0: x, y0: y, x1: x, y1: y });
            return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        snapshot();
        drawing.current = true;
        setDirty(true);
        stroke(x, y);
    };
    const onMove = (e: React.PointerEvent) => {
        if (!drawing.current) return;
        const { x, y } = pos(e);
        if (mode === "box") { setRect((r) => (r ? { ...r, x1: x, y1: y } : r)); return; }
        stroke(x, y);
    };
    const onUp = () => {
        drawing.current = false;
        if (mode === "box") {
            if (rect) applyRect(rect);
            setRect(null);
            return;
        }
        emit();
    };

    const undo = () => {
        const last = history.current.pop();
        const v = viewRef.current?.getContext("2d");
        const m = maskRef.current?.getContext("2d");
        if (!last || !v || !m) return;
        v.globalCompositeOperation = "source-over";
        m.globalCompositeOperation = "source-over";
        v.putImageData(last.view, 0, 0);
        m.putImageData(last.mask, 0, 0);
        const empty = history.current.length === 0;
        setDirty(!empty);
        onMaskChange(empty ? null : maskRef.current!.toDataURL("image/png"));
    };

    const clear = () => {
        const view = viewRef.current, mask = maskRef.current;
        const v = view?.getContext("2d"), m = mask?.getContext("2d");
        if (!view || !mask || !v || !m) return;
        v.clearRect(0, 0, view.width, view.height);
        m.globalCompositeOperation = "source-over";
        m.fillStyle = "#fff";
        m.fillRect(0, 0, mask.width, mask.height);
        history.current = [];
        setDirty(false);
        onMaskChange(null);
    };

    return (
        <div className={cn("absolute inset-0 flex items-center justify-center", className)}>
            {/* `inset-0` + medición por JS.
                `max-h-full` en CSS NO alcanzaba: el padre es un flex que crece con su
                contenido, así que "full" era la altura de la propia imagen y nunca la
                limitaba — por eso al entrar al pincel la imagen se cortaba abajo.
                Ahora el contenedor se ancla al área disponible (`absolute inset-0`) y
                `fit` calcula el tamaño que entra, con margen para la barra flotante. */}
            <div
                ref={wrapRef}
                className="relative rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-1)]"
                style={{ width: fit.w || undefined, height: fit.h || undefined }}
            >
                <img src={imageUrl} alt="" onLoad={sync} className="block w-full h-full object-contain select-none" draggable={false} />
                {/* La máscara real nunca se ve: vive fuera de pantalla. */}
                <canvas ref={maskRef} className="hidden" />
                {/* El canvas se dimensiona por ESTILO al mismo tamaño que el bitmap
                    (ver `sync`). Con `w-full h-full` tomaba el tamaño del wrapper, y
                    si ese no calzaba exacto con la imagen el trazo salía corrido. */}
                <canvas
                    ref={viewRef}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerLeave={onUp}
                    style={{ width: box.w || undefined, height: box.h || undefined }}
                    className="absolute top-0 left-0 cursor-crosshair touch-none"
                />
            </div>

            {/* Los controles FLOTAN sobre la imagen. Antes eran una fila debajo y,
                sumados al texto de ayuda, empujaban la imagen fuera del viewport:
                al activar el pincel la parte de abajo desaparecía. */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 px-3 h-10 rounded-lg border border-[var(--color-edge-strong)] bg-[var(--color-surface-2)] shadow-lg">
                {/* Modo: varita (SAM) o pincel. La varita es el default — tocar el
                    objeto es más rápido y más preciso que pintarlo a mano. */}
                <div className="flex items-center gap-0.5 pr-2.5 mr-0.5 border-r border-[var(--color-edge-subtle)]">
                    <button
                        onClick={() => setMode("box")}
                        title="Recuadro — arrastrá sobre la zona a cambiar"
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer",
                            mode === "box" ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)]" : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-3)]",
                        )}
                    >
                        <SquareDashed size={13} />
                    </button>
                    <button
                        onClick={() => setMode("wand")}
                        title="Varita — tocá un objeto y se selecciona solo"
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer",
                            mode === "wand" ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)]" : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-3)]",
                        )}
                    >
                        <Wand2 size={13} />
                    </button>
                    <button
                        onClick={() => setMode("brush")}
                        title="Pincel — pintar a mano"
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer",
                            mode === "brush" ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)]" : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-3)]",
                        )}
                    >
                        <BrushIcon size={13} />
                    </button>
                </div>
                {/* El tamaño del pincel sólo aplica al modo pincel. */}
                <Eraser size={13} className={cn("shrink-0", mode === "brush" ? "text-fg-faint" : "text-fg-faint/30")} />
                <input
                    type="range" min={10} max={120} value={brush}
                    disabled={mode !== "brush"}
                    onChange={(e) => setBrush(Number(e.target.value))}
                    className="flex-1 accent-[var(--color-brand)] cursor-pointer"
                    title="Tamaño del pincel"
                />
                <button
                    onClick={undo}
                    disabled={history.current.length === 0}
                    title="Deshacer"
                    className="w-7 h-7 flex items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Undo2 size={13} />
                </button>
                <button
                    onClick={clear}
                    disabled={!dirty}
                    title="Borrar la selección"
                    className="w-7 h-7 flex items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Trash2 size={13} />
                </button>
            </div>

            <p className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 text-[10.5px] whitespace-nowrap px-2.5 py-1 rounded border border-[var(--color-edge-subtle)] bg-[var(--color-surface-1)] text-fg-muted">
                {dirty
                    ? "Se regenera SÓLO lo marcado."
                    : mode === "box"
                        ? "Arrastrá un recuadro sobre lo que querés cambiar."
                        : mode === "wand"
                            ? "Tocá el objeto que querés cambiar."
                            : "Pintá sobre lo que querés cambiar."}
            </p>

            {/* Preview del recuadro mientras se arrastra. */}
            {rect && (
                <div
                    className="absolute z-10 border-2 pointer-events-none"
                    style={{
                        borderColor: "var(--color-brand)",
                        background: "rgba(255,95,143,.18)",
                        left: Math.min(rect.x0, rect.x1) + (wrapRef.current?.offsetLeft ?? 0),
                        top: Math.min(rect.y0, rect.y1) + (wrapRef.current?.offsetTop ?? 0),
                        width: Math.abs(rect.x1 - rect.x0),
                        height: Math.abs(rect.y1 - rect.y0),
                    }}
                />
            )}

            {segError && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 max-w-[min(90%,28rem)] px-3 py-2 rounded-lg border text-[11px] leading-snug text-center"
                     style={{ borderColor: "var(--color-error)", background: "var(--color-error-muted)", color: "var(--color-fg)" }}>
                    {segError}
                </div>
            )}

            {segmenting && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                    <span className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--color-edge-strong)] bg-[var(--color-surface-2)] text-[12px] text-fg">
                        <Loader2 size={13} className="animate-spin" /> Seleccionando…
                    </span>
                </div>
            )}
        </div>
    );
}
