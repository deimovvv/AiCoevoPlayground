import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { backendUrl } from "../../lib/api";

/**
 * Una lámina grande (Entregas, vista de una lámina) que se mira como en Miro:
 * - siempre entra entera: el tamaño sale de medir el lugar y la imagen, no de alturas en % (en
 *   ventanas chicas de Windows se cortaba y no se podía scrollear);
 * - zoom con el trackpad (pellizcar) o ⌘/Ctrl + rueda, centrado en el mouse; los botones de afuera
 *   hacen zoom sin perder el centro;
 * - arrastrar mueve la imagen ampliada; un clic sin arrastrar marca un punto para comentar (`onPick`).
 * Los hijos (los puntos de los comentarios) van en % sobre la imagen: no se corren con el zoom.
 */

const MIN = 1, MAX = 6;
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

export function SlideStage({ url, kind, poster, zoom, onZoom, onPick, children }: {
    url: string;
    kind: "image" | "video";
    poster?: string | null;
    zoom: number;
    onZoom: (z: number) => void;
    onPick?: (e: MouseEvent<HTMLDivElement>) => void;
    children?: ReactNode;
}) {
    const stage = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
    // Punto que tiene que quedar quieto al cambiar el zoom (en px del lugar visible). null = el centro.
    const anchor = useRef<{ x: number; y: number } | null>(null);
    const prev = useRef({ w: 0, h: 0 });
    const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
    const [grabbing, setGrabbing] = useState(false);

    useEffect(() => {
        const el = stage.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const fit = nat && box.w && box.h ? Math.min(box.w / nat.w, box.h / nat.h) : 0;
    const w = Math.round((nat?.w ?? 0) * fit * zoom);
    const h = Math.round((nat?.h ?? 0) * fit * zoom);
    const ready = w > 0 && h > 0;

    // Al cambiar el tamaño, mover el scroll para que el punto ancla (el mouse, o el centro) no se corra.
    useLayoutEffect(() => {
        const el = stage.current;
        const p = prev.current;
        prev.current = { w, h };
        if (!el || !p.w || !p.h || (p.w === w && p.h === h)) return;
        const a = anchor.current ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
        anchor.current = null;
        // La imagen está centrada cuando es más chica que el lugar: su borde izquierdo es max(0, (lugar - ancho) / 2).
        const offX = (cw: number, iw: number) => Math.max(0, (cw - iw) / 2);
        const rx = (el.scrollLeft + a.x - offX(el.clientWidth, p.w)) / p.w;
        const ry = (el.scrollTop + a.y - offX(el.clientHeight, p.h)) / p.h;
        el.scrollLeft = rx * w + offX(el.clientWidth, w) - a.x;
        el.scrollTop = ry * h + offX(el.clientHeight, h) - a.y;
    }, [w, h]);

    // Pellizcar el trackpad llega como rueda con ctrlKey; ⌘ + rueda también. Hace falta un listener no pasivo.
    useEffect(() => {
        const el = stage.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            anchor.current = { x: e.clientX - r.left, y: e.clientY - r.top };
            onZoom(clamp(zoom * Math.exp(-e.deltaY * 0.01)));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoom, onZoom]);

    const onDown = (e: React.PointerEvent) => {
        const el = stage.current;
        if (!el || e.button !== 0 || zoom <= 1) return;
        drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
    };
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current, el = stage.current;
        if (!d || !el) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        if (!d.moved) { d.moved = true; setGrabbing(true); }
        el.scrollLeft = d.sl - dx;
        el.scrollTop = d.st - dy;
    };
    const onUp = () => { setGrabbing(false); setTimeout(() => { drag.current = null; }, 0); };

    return (
        <div ref={stage} className="absolute inset-0 overflow-auto overscroll-contain"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <div className="min-w-full min-h-full flex">
                <div className={`relative m-auto shrink-0 select-none ${grabbing ? "cursor-grabbing" : zoom > 1 ? "cursor-grab" : onPick ? "cursor-crosshair" : ""}`}
                    style={ready ? { width: w, height: h } : { visibility: "hidden" }}
                    onClick={(e) => { if (drag.current?.moved) return; onPick?.(e); }}>
                    {kind === "video"
                        ? <video src={backendUrl(url)} poster={poster ? backendUrl(poster) : undefined} controls
                            onLoadedMetadata={(e) => setNat({ w: e.currentTarget.videoWidth || 9, h: e.currentTarget.videoHeight || 16 })}
                            className="block w-full h-full rounded-[var(--radius-xs)]" />
                        : <img src={backendUrl(url)} alt="" draggable={false}
                            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                            className="block w-full h-full rounded-[var(--radius-xs)] shadow-[0_8px_30px_rgba(0,0,0,0.35)] pointer-events-none" />}
                    {ready && children}
                </div>
            </div>
            {zoom > 1 && !grabbing && (
                <span className="pointer-events-none sticky bottom-2 left-2 float-left ml-2 mb-2 px-2 py-1 rounded-[3px] bg-black/60 text-white text-[11px]">
                    Arrastrá para moverte · clic para comentar
                </span>
            )}
        </div>
    );
}
