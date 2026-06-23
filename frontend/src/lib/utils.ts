import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** `accept` para inputs de imagen — más explícito que `"image/*"` porque Windows
 *  no incluye HEIC/HEIF en el wildcard image/* (Windows manda
 *  application/octet-stream para HEIC). Sin esto, los uploads HEIC desde Windows
 *  ni siquiera dejan seleccionar el archivo en el picker nativo. */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,.HEIC,.HEIF,image/heic,image/heif";

/** Descarga un archivo desde una URL como blob — fuerza la descarga incluso cuando
 *  la URL es cross-origin (Fal CDN, etc.) donde `<a download>` falla y termina
 *  abriendo una pestaña nueva. Si el fetch falla por CORS, cae a window.open.
 *  Usado por TODOS los botones "Descargar" del app (ToolRunPage, ReviewPage, Lab).
 */
export async function downloadUrl(url: string, filename: string): Promise<void> {
    try {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Cleanup en next tick para que el browser termine la descarga.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
        console.warn("[downloadUrl] fetch failed, falling back to window.open:", e);
        window.open(url, "_blank", "noopener,noreferrer");
    }
}
