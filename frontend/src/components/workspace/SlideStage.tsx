import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { backendUrl } from "../../lib/api";

/**
 * Una lámina grande que SIEMPRE entra en el espacio que hay (Entregas, vista de una lámina).
 * El tamaño se calcula midiendo el espacio y la imagen, no con alturas en %: así no se corta en
 * ninguna pantalla (pasaba en Windows con ventanas chicas: la imagen quedaba más alta que el lugar
 * y no se podía scrollear). Con `zoom` > 1 se agranda y se recorre con scroll.
 * Los hijos (los puntos de los comentarios) se ubican en % sobre la imagen: no se corren con el zoom.
 */
export function SlideStage({ url, kind, poster, zoom, onPick, children }: {
    url: string;
    kind: "image" | "video";
    poster?: string | null;
    zoom: number;
    onPick?: (e: MouseEvent<HTMLDivElement>) => void;
    children?: ReactNode;
}) {
    const stage = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });          // lugar disponible
    const [nat, setNat] = useState<{ w: number; h: number } | null>(null);   // tamaño real de la imagen

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

    return (
        <div ref={stage} className="absolute inset-0 overflow-auto">
            {/* m-auto centra cuando entra; cuando es más grande, el scroll arranca arriba a la izquierda */}
            <div className="min-w-full min-h-full flex">
                <div className={`relative m-auto shrink-0 select-none ${onPick ? "cursor-crosshair" : ""}`}
                    style={ready ? { width: w, height: h } : { visibility: "hidden" }} onClick={onPick}>
                    {kind === "video"
                        ? <video src={backendUrl(url)} poster={poster ? backendUrl(poster) : undefined} controls
                            onLoadedMetadata={(e) => setNat({ w: e.currentTarget.videoWidth || 9, h: e.currentTarget.videoHeight || 16 })}
                            className="block w-full h-full rounded-[var(--radius-xs)]" />
                        : <img src={backendUrl(url)} alt="" draggable={false}
                            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                            className="block w-full h-full rounded-[var(--radius-xs)] shadow-[0_8px_30px_rgba(0,0,0,0.35)]" />}
                    {ready && children}
                </div>
            </div>
        </div>
    );
}
