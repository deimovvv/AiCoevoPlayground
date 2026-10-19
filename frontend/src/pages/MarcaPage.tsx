import type { ReactNode } from "react";
import { Link } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, type Brand } from "../lib/api";
import { cn } from "../lib/utils";

/**
 * Marca — la entrada de Studio (openspec/changes/studio-v2 §1 y §7).
 *
 * La memoria de la marca en seis bloques: lo que Claude lee antes de producir cualquier pieza
 * (MCP `coevo-studio`, `ver_marca`). Cada bloque dice si está completo o qué falta y qué impide
 * eso. Se edita en la pantalla de la marca de siempre (BrandSettings) hasta que cada bloque
 * tenga su propia edición.
 */

type State = "completo" | "parcial" | "falta";
const STATE: Record<State, { label: string; cls: string }> = {
    completo: { label: "● completo", cls: "text-[var(--color-success)]" },
    parcial: { label: "◐ a medias", cls: "text-[var(--color-warning)]" },
    falta: { label: "○ falta", cls: "text-[var(--color-brand)]" },
};
const mono = "font-mono text-[10px] uppercase tracking-[0.08em]";

const state = (...parts: boolean[]): State =>
    parts.every(Boolean) ? "completo" : parts.some(Boolean) ? "parcial" : "falta";
const firstSentence = (t?: string, max = 170) => {
    const s = (t || "").replace(/\s+/g, " ").trim();
    const cut = s.split(/(?<=[.!?])\s/)[0] || s;
    return cut.length > max ? cut.slice(0, max - 1) + "…" : cut;
};

function Block({ n, title, st, children, empty, editTo }: {
    n: string; title: string; st: State; children: ReactNode; empty?: boolean; editTo: string;
}) {
    return (
        <section className={cn(
            "rounded-[var(--radius-md)] p-5 flex flex-col gap-3.5 min-h-[260px] min-w-0",
            empty ? "border border-dashed border-[var(--color-edge-strong)]" : "bg-[var(--color-surface-1)] border border-edge"
        )}>
            <div className={`${mono} flex items-center gap-2 text-fg-faint`}>
                <span>{n}</span><span className="text-fg">{title}</span>
                <span className="flex-1" />
                <span className={STATE[st].cls}>{STATE[st].label}</span>
            </div>
            {children}
            <span className="flex-1" />
            <Link to={editTo} className="text-[12px] text-fg-muted hover:text-fg no-underline">Editar →</Link>
        </section>
    );
}

function Thumbs({ urls, round }: { urls: string[]; round?: boolean }) {
    return (
        <div className={cn("grid gap-1.5", round ? "grid-cols-[repeat(auto-fill,64px)]" : "grid-cols-3")}>
            {urls.map((u, i) => (
                <img key={i} src={backendUrl(u)} alt="" loading="lazy"
                    className={round ? "w-16 h-16 rounded-full object-cover" : "w-full aspect-[4/5] object-cover rounded-[var(--radius-xs)]"} />
            ))}
        </div>
    );
}

function blocks(b: Brand) {
    const dna = b.dna || {};
    const ds = b.designSystem || {};
    const logo = b.logo?.imageUrl || b.logos?.[0]?.imageUrl;
    const colors = dna.colors || [];
    const fonts = [...new Set([b.fonts?.headline, b.fonts?.body].filter(Boolean) as string[])];
    const looks = [...(b.moodboards || []), ...(b.lookAndFeel || []), ...(b.backgrounds || [])].map((x) => x.imageUrl);
    const faces = (b.avatars || []).map((a) => a.imageUrl).filter(Boolean) as string[];
    const catalog = [...(b.products || []), ...(b.clothing || [])].map((x) => x.imageUrl);
    return { dna, ds, logo, colors, fonts, looks, faces, catalog };
}

export function MarcaPage() {
    const { activeBrand } = useBrand();
    if (!activeBrand) {
        return <p className="text-[14px] text-fg-muted">Elegí una marca arriba para ver su memoria.</p>;
    }
    const b = activeBrand;
    const { dna, ds, logo, colors, fonts, looks, faces, catalog } = blocks(b);
    const edit = `/dashboard/brands/${b.id}`;

    const st: State[] = [
        state(!!b.brandContext, !!(dna.tone?.length || dna.personality)),
        state(!!logo, colors.length > 0, fonts.length > 0),
        state(!!ds.photoStyle, looks.length > 0),
        state(faces.length > 0),
        state(catalog.length > 0),
        "falta",
    ];
    const done = st.filter((s) => s === "completo").length;

    return (
        <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-end gap-6">
                <div>
                    <p className={`${mono} text-fg-faint`}>Memoria de la marca · {done} de 6 completos</p>
                    <h1 className="mt-2 text-[44px] leading-none tracking-[-0.035em] text-fg">{b.name}</h1>
                </div>
                <span className="flex-1" />
                <p className="max-w-[360px] text-[13px] leading-relaxed text-fg-muted">
                    Es lo que Claude lee antes de producir cualquier pieza para la marca.
                </p>
                <Link to={edit} className="h-10 px-4 flex items-center rounded-[var(--radius-sm)] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] font-medium no-underline">
                    Cargar marca
                </Link>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                <Block n="01" title="Quién es" st={st[0]} empty={st[0] === "falta"} editTo={edit}>
                    {b.brandContext || b.business?.value_prop ? (
                        <p className="text-[19px] leading-snug tracking-[-0.015em] text-fg">{firstSentence(b.business?.value_prop || b.brandContext)}</p>
                    ) : <p className="text-[15px] text-fg-muted">Todavía no sabemos quién es la marca.</p>}
                    {(dna.tone?.length || dna.forbidden_words?.length) ? (
                        <p className="text-[12px] leading-relaxed text-fg-muted">
                            {dna.tone?.length ? <>Tono: {dna.tone.slice(0, 3).join(", ")}.</> : null}
                            {dna.forbidden_words?.length ? <> Nunca: {dna.forbidden_words.slice(0, 3).map((w) => `"${w}"`).join(", ")}.</> : null}
                        </p>
                    ) : null}
                </Block>

                <Block n="02" title="Identidad gráfica" st={st[1]} empty={st[1] === "falta"} editTo={edit}>
                    {logo ? <img src={backendUrl(logo)} alt={`Logo de ${b.name}`} className="h-14 w-auto max-w-[220px] object-contain self-start" />
                        : <span className="text-[44px] font-semibold tracking-[-0.05em] leading-none text-fg-faint">{b.name.toLowerCase()}</span>}
                    {colors.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                            {colors.slice(0, 6).map((c) => (
                                <span key={c.hex + c.name} title={`${c.name} · ${c.hex}`} style={{ background: c.hex }}
                                    className="w-9 h-9 rounded-[var(--radius-xs)] border border-edge" />
                            ))}
                        </div>
                    )}
                    <p className="text-[12px] text-fg-muted">
                        {fonts.length ? fonts.join(" · ") : "Sin tipografías"}{!logo && " · falta el logo"}
                    </p>
                </Block>

                <Block n="03" title="Dirección de foto y video" st={st[2]} empty={st[2] === "falta"} editTo={edit}>
                    {looks.length > 0 && <Thumbs urls={looks.slice(0, 3)} />}
                    <p className="text-[12px] leading-relaxed text-fg-muted">
                        {ds.photoStyle ? firstSentence(ds.photoStyle, 150) : "Sin reglas de foto: Claude no sabe cómo se ve la marca."}
                    </p>
                </Block>

                <Block n="04" title="Caras" st={st[3]} empty={st[3] === "falta"} editTo={edit}>
                    {faces.length > 0 ? <Thumbs urls={faces.slice(0, 6)} round />
                        : <p className="text-[15px] text-fg-muted">Sin avatares ni modelos.</p>}
                    <p className="text-[12px] text-fg-muted">
                        {(b.avatars || []).slice(0, 4).map((a) => a.name.split(" ")[0]).join(" · ")}
                        {b.voicePresets?.length ? ` · voces: ${b.voicePresets.length}` : ""}
                    </p>
                </Block>

                <Block n="05" title="Catálogo" st={st[4]} empty={st[4] === "falta"} editTo={edit}>
                    {catalog.length > 0 ? (
                        <>
                            <Thumbs urls={catalog.slice(0, 3)} />
                            <p className="text-[12px] text-fg-muted">
                                {(b.products?.length || 0)} productos · {(b.clothing?.length || 0)} prendas
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-[19px] leading-snug tracking-[-0.015em] text-fg-muted">Todavía no hay productos ni prendas.</p>
                            <p className="text-[12px] leading-relaxed text-fg-muted">Sin catálogo, las fichas y la prenda sobre modelo no se pueden hacer para esta marca.</p>
                        </>
                    )}
                </Block>

                <Block n="06" title="Plantillas" st={st[5]} empty editTo={edit}>
                    <p className="text-[19px] leading-snug tracking-[-0.015em] text-fg-muted">Todavía no hay plantillas guardadas.</p>
                    <p className="text-[12px] leading-relaxed text-fg-muted">
                        Carrusel, reel, story: se guardan acá cuando una pieza se aprueba, para repetir el formato.
                    </p>
                </Block>
            </div>
        </div>
    );
}
