import type { ReactNode } from "react";

/**
 * El texto de una marca, legible. El agente y los PDF dejan `brandContext` en markdown (**negritas**,
 * `---`, «**1. Esencia**», viñetas): mostrado crudo se lee como código. Esto cubre sólo eso —títulos,
 * negritas, viñetas, separadores y párrafos—, sin sumar una librería.
 */

function inline(text: string): ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-medium text-fg">{part.slice(2, -2)}</strong> : part);
}

type Block = { kind: "h" | "hr" | "p" | "ul"; lines: string[] };

/** Línea por línea: los textos del agente traen títulos pegados al párrafo, sin línea en blanco. */
function parse(text: string): Block[] {
    const out: Block[] = [];
    const push = (kind: Block["kind"], line: string) => {
        const last = out[out.length - 1];
        if (last && last.kind === kind && (kind === "p" || kind === "ul")) last.lines.push(line);
        else out.push({ kind, lines: [line] });
    };
    let gap = false;
    for (const raw of text.replace(/\r/g, "").split("\n")) {
        const l = raw.trim();
        if (!l) { gap = true; continue; }
        // Título: «# …», «**…**» solo en la línea, o «1. Algo» corto y sin punto final (así los escribe el agente).
        const h = l.match(/^#{1,4}\s+(.+)$/) || l.match(/^\*\*([^*]+)\*\*:?$/) || (l.length < 60 && !/[.:;]$/.test(l) ? l.match(/^(\d+\.\s+.+)$/) : null);
        if (/^-{3,}$/.test(l)) out.push({ kind: "hr", lines: [] });
        else if (h) out.push({ kind: "h", lines: [h[1].replace(/^\d+\.\s*/, "")] });
        else if (/^[-*•]\s+/.test(l)) { if (gap && out[out.length - 1]?.kind === "ul") out.push({ kind: "ul", lines: [] }); push("ul", l.replace(/^[-*•]\s+/, "")); }
        else if (gap || out[out.length - 1]?.kind !== "p") out.push({ kind: "p", lines: [l] });
        else push("p", l);
        gap = false;
    }
    return out;
}

export function MiniMarkdown({ text, className = "" }: { text: string; className?: string }) {
    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            {parse(text).map((b, i) => {
                if (b.kind === "hr") return <hr key={i} className="border-edge" />;
                if (b.kind === "h") return <h3 key={i} className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-fg-faint">{b.lines[0]}</h3>;
                if (b.kind === "ul") return <ul key={i} className="flex flex-col gap-1">{b.lines.map((l, j) => <li key={j} className="pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-fg-faint">{inline(l)}</li>)}</ul>;
                return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && " "}{inline(l)}</span>)}</p>;
            })}
        </div>
    );
}

/** El mismo texto en una línea, sin marcas: para resúmenes. */
export const plainText = (t: string) => t.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/\s+/g, " ").trim();
