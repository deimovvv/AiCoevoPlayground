import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, type Brand } from "../lib/api";
import { loadBrandFonts } from "../tools/shared/fontLoader";
import { BrandBlockEditor, type BlockKey } from "../components/workspace/BrandBlockEditor";
import { BrandAgentPanel } from "../components/workspace/BrandAgentPanel";
import { approveBrandBlock } from "../lib/api";

/**
 * Marca — la entrada de Studio (openspec/changes/studio-v2 §1 y §7).
 *
 * Compuesta para la pantalla entera: a la izquierda la marca como portada (su nombre en su
 * tipografía, sus colores, cuánto está completo); a la derecha la memoria en cinco bloques que
 * llenan el alto, con las imágenes grandes. En celular, todo en una columna.
 * Es lo que Claude lee antes de producir (MCP `ver_marca`).
 * `readOnly`: «Mi marca» del cliente (sin editar ni cargar, sin plantillas).
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

const clip = (t: string | undefined, max: number) => {
    const s = (t || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
};
const count = (n: number | undefined, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");

function Card({ n, title, missing, children, onEdit, className = "", proposed, onApprove }: {
    n: string; title: string; missing?: string | true | null; children: ReactNode; onEdit?: () => void; className?: string;
    /** Lo propuso el agente y nadie lo revisó todavía. */
    proposed?: boolean; onApprove?: () => void;
}) {
    return (
        <section className={`group relative flex flex-col gap-4 p-5 rounded-[4px] border border-edge bg-[var(--color-surface-1)] min-w-0 min-h-0 overflow-hidden ${onEdit ? "hover:border-[var(--color-edge-strong)]" : ""} ${className}`}>
            {/* Todo el bloque abre su edición (panel al costado). */}
            {onEdit && <button onClick={onEdit} aria-label={`Editar ${title}`} className="absolute inset-0 z-10 cursor-pointer" />}
            <div className="flex items-baseline gap-3 shrink-0">
                <span className={`${mono} text-fg-faint`}>{n}</span>
                <h2 className="text-[15px] tracking-[-0.01em] text-fg">{title}</h2>
                <span className="flex-1" />
                {proposed ? (
                    <span className="relative z-20 flex items-center gap-2">
                        <span className={`${mono} text-[var(--color-warning)]`}>Propuesto · revisar</span>
                        {onApprove && <button onClick={onApprove} className="h-6 px-2 rounded-[3px] border border-edge text-[11px] text-fg hover:border-fg cursor-pointer">Aprobar</button>}
                    </span>
                ) : missing
                    ? <span className={`${mono} text-[var(--color-brand)]`}>{missing === true ? "Falta" : `Falta ${missing}`}</span>
                    : onEdit && <span className="text-[12px] text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity">Editar</span>}
            </div>
            {children}
        </section>
    );
}

const Note = ({ children }: { children: ReactNode }) => <p className="shrink-0 text-[12px] leading-relaxed text-fg-muted">{children}</p>;
const Empty = ({ children }: { children: ReactNode }) => <p className="text-[14px] leading-relaxed text-fg-faint">{children}</p>;

/** Imágenes que llenan el espacio del bloque (en celular, un alto fijo). */
function Fill({ urls, faces, small }: { urls: string[]; faces?: boolean; small?: boolean }) {
    return (
        <div className={`flex-1 ${small ? "min-h-[110px]" : "min-h-[200px]"} md:min-h-0 grid gap-1.5 overflow-hidden`}
            style={{ gridTemplateColumns: `repeat(${urls.length}, minmax(0, 1fr))`, gridTemplateRows: "minmax(0, 1fr)" }}>
            {urls.map((u, i) => (
                <img key={i} src={backendUrl(u)} alt="" loading="lazy"
                    className={`w-full h-full object-cover rounded-[2px] ${faces ? "object-top" : ""}`} />
            ))}
        </div>
    );
}

function data(b: Brand) {
    const dna = b.dna || {};
    const ds = b.designSystem || {};
    return {
        dna, ds,
        logo: b.logo?.imageUrl || b.logos?.[0]?.imageUrl,
        colors: dna.colors || [],
        fonts: [...new Set([b.fonts?.headline, b.fonts?.body].filter(Boolean) as string[])],
        looks: [...(b.moodboards || []), ...(b.lookAndFeel || []), ...(b.backgrounds || []), ...(b.poses || []), ...(b.shotRefs || [])].map((x) => x.imageUrl),
        // Separado como en un tablero de dirección: moodboard · luz · locación.
        lookGroups: [
            // Un moodboard por tablero (ej. uno traído de Pinterest); las sueltas, juntas.
            ...[...new Set((b.moodboards || []).map((x) => x.board ?? ""))].sort((x, y) => (x === "" ? 1 : y === "" ? -1 : x.localeCompare(y)))
                .map((k) => ({ label: k ? `Moodboard · ${k}` : "Moodboard", urls: (b.moodboards || []).filter((x) => (x.board ?? "") === k).map((x) => x.imageUrl) })),
            { label: "Luz / look", urls: (b.lookAndFeel || []).map((x) => x.imageUrl) },
            { label: "Locación", urls: (b.backgrounds || []).map((x) => x.imageUrl) },
            { label: "Planos", urls: (b.shotRefs || []).map((x) => x.imageUrl) },
            // Las poses son para copiar postura en fichas (Ecommerce Pack), no la estética: van al final.
            { label: "Poses de catálogo", urls: (b.poses || []).map((x) => x.imageUrl) },
        ].filter((g) => g.urls.length),
        faces: (b.avatars || []).filter((a) => a.imageUrl),
        catalog: [...(b.products || []), ...(b.clothing || [])].map((x) => x.imageUrl),
    };
}

export function MarcaPage({ readOnly = false }: { readOnly?: boolean }) {
    const { activeBrand, setActiveBrandId, refreshBrands } = useBrand();
    const [editing, setEditing] = useState<BlockKey | null>(null);
    const [agentOpen, setAgentOpen] = useState(false);
    const [params, setParams] = useSearchParams();
    // ?marca=<id> abre esa marca (links directos a la memoria de una marca).
    const wanted = params.get("marca");
    useEffect(() => {
        if (!wanted) return;
        setActiveBrandId(wanted);
        setParams({}, { replace: true });
    }, [wanted, setActiveBrandId, setParams]);
    const fonts = activeBrand?.fonts;
    // Las tipografías de la marca se cargan para mostrar su nombre escrito con ellas.
    useEffect(() => { if (fonts?.headline || fonts?.body) loadBrandFonts(fonts); }, [fonts]);

    if (!activeBrand) return <p className="p-8 text-[14px] text-fg-muted">Elegí una marca arriba para ver su memoria.</p>;
    const b = activeBrand;
    const { dna, ds, logo, colors, fonts: fontNames, looks, lookGroups, faces, catalog } = data(b);
    const edit = (k: BlockKey) => (readOnly ? undefined : () => setEditing(k));
    const brandFont = b.fonts?.headline ? `"${b.fonts.headline}", ui-serif, serif` : undefined;

    // Texto = qué falta adentro del bloque; true = falta el bloque entero.
    const missing: (string | true | null)[] = [
        !b.brandContext ? true : null,
        !logo ? "logo" : !colors.length ? "colores" : null,
        !ds.photoStyle ? "reglas" : !looks.length ? "referencias" : null,
        !faces.length ? true : null,
        !catalog.length ? true : null,
        (b.carouselRefs?.length ?? 0) > 0 ? null : true,
    ];
    const done = missing.filter((m) => !m).length;
    const proposed = (k: string) => !readOnly && b.agent?.blocks?.[k] === "propuesto";
    const approve = (k: string) => async () => { await approveBrandBlock(b.id, k); await refreshBrands(); };

    return (
        <div className="md:h-full md:grid md:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
            {/* ── La marca como portada ── */}
            <aside className="flex flex-col gap-8 p-6 md:p-10 border-b md:border-b-0 md:border-r border-edge md:min-h-0 md:overflow-y-auto">
                <div className="flex flex-col gap-3">
                    <p className={`${mono} text-fg-faint`}>{readOnly ? "Así entendemos tu marca" : "Memoria de la marca"}</p>
                    {!readOnly && (
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1" aria-label={`${done} de 6 completos`}>
                                {missing.map((m, i) => <span key={i} className={`w-5 h-[3px] rounded-full ${m ? "bg-[var(--color-edge-strong)]" : "bg-fg"}`} />)}
                            </div>
                            <span className="font-mono text-[11px] text-fg-muted">{done} de 6</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-6 md:flex-1 md:justify-center">
                    {logo && <img src={backendUrl(logo)} alt={`Logo de ${b.name}`} className="h-16 w-auto max-w-[240px] object-contain self-start" />}
                    <h1 className="text-[44px] md:text-[clamp(40px,4.2vw,64px)] leading-[0.98] tracking-[-0.03em] text-fg" style={{ fontFamily: brandFont }}>
                        {b.name}
                    </h1>
                    {colors.length > 0 && (
                        <div>
                            <div className="flex h-12 rounded-[3px] overflow-hidden">
                                {colors.slice(0, 6).map((c) => <span key={c.hex + c.name} title={c.name} style={{ background: c.hex }} className="flex-1" />)}
                            </div>
                            <div className="flex mt-2">
                                {colors.slice(0, 6).map((c) => <span key={c.hex + c.name} className="flex-1 font-mono text-[10px] text-fg-faint truncate">{c.hex.toLowerCase()}</span>)}
                            </div>
                        </div>
                    )}
                    {proposed("identidad") && (
                        <p className="flex items-center gap-2">
                            <span className={`${mono} text-[var(--color-warning)]`}>Identidad propuesta · revisar</span>
                            <button onClick={approve("identidad")} className="h-6 px-2 rounded-[3px] border border-edge text-[11px] text-fg hover:border-fg cursor-pointer">Aprobar</button>
                        </p>
                    )}
                    <dl className="grid grid-cols-[84px_1fr] gap-y-1.5 text-[13px]">
                        <dt className="text-fg-faint">Tipografía</dt>
                        <dd className="text-fg">{fontNames.length ? fontNames.join(" / ") : <span className="text-fg-faint">sin cargar</span>}</dd>
                        <dt className="text-fg-faint">Logo</dt>
                        <dd className={logo ? "text-fg" : "text-[var(--color-brand)]"}>{logo ? "cargado" : "falta"}</dd>
                        {dna.tone?.length ? <><dt className="text-fg-faint">Tono</dt><dd className="text-fg">{dna.tone.slice(0, 3).join(", ").toLowerCase()}</dd></> : null}
                        {/* El design system es de Coevo (Claude Design): el cliente no lo ve. */}
                        {!readOnly && <><dt className="text-fg-faint">Design system</dt>
                            <dd>{b.designSystemUrl
                                ? <a href={b.designSystemUrl} target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2">abrir en Claude ↗</a>
                                : <span className="text-fg-faint">sin armar</span>}</dd></>}
                    </dl>
                </div>

                <div className="flex flex-col gap-4">
                    <p className="text-[13px] leading-relaxed text-fg-muted">
                        {readOnly ? "Es lo que usamos para producir cada pieza. Si algo no está bien, avisanos." : "Es lo que Claude lee antes de producir cualquier pieza para la marca."}
                    </p>
                    {!readOnly && (
                        <div className="flex items-center gap-4">
                            <button onClick={() => setAgentOpen(true)} className="h-10 px-4 flex items-center rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer">
                                Armar con el agente
                            </button>
                            <button onClick={() => setEditing("material")} className="text-[13px] text-fg-muted hover:text-fg cursor-pointer">Cargar material</button>
                            <button onClick={() => setEditing("identidad")} className="text-[13px] text-fg-muted hover:text-fg cursor-pointer">Editar identidad</button>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── La memoria, llenando el alto ── */}
            <div className="p-3 md:p-4 grid gap-3 grid-cols-1 md:grid-cols-2 md:grid-rows-3 md:h-full md:min-h-0">
                <Card n="01" title="Dirección de foto y video" missing={missing[2]} onEdit={edit("foto")} proposed={proposed("foto")} onApprove={approve("foto")} className="md:row-span-2">
                    {lookGroups.length > 0 ? (
                        <div className="flex-1 min-h-0 flex flex-col gap-3">
                            {lookGroups.map((g) => (
                                <div key={g.label} className="flex-1 min-h-[140px] md:min-h-0 flex flex-col gap-1.5 overflow-hidden">
                                    <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-fg-faint shrink-0">{g.label} · {g.urls.length}</p>
                                    <Fill urls={g.urls.slice(0, 4)} small />
                                </div>
                            ))}
                        </div>
                    ) : <div className="flex-1" />}
                    {ds.photoStyle ? <Note>{clip(ds.photoStyle, 200)}</Note> : <Empty>Sin reglas de foto: Claude no sabe cómo se ve la marca.</Empty>}
                </Card>

                <Card n="02" title="Quién es" missing={missing[0]} onEdit={edit("quien")} proposed={proposed("quien")} onApprove={approve("quien")}>
                    {b.brandContext || b.business?.value_prop
                        ? <p className="text-[15px] leading-[1.5] tracking-[-0.005em] text-fg">{clip(b.business?.value_prop || b.brandContext, 170)}</p>
                        : <Empty>Todavía no sabemos quién es la marca.</Empty>}
                    {dna.forbidden_words?.length ? <Note>Nunca dice {dna.forbidden_words.slice(0, 3).map((w) => `«${w.toLowerCase()}»`).join(", ")}.</Note> : null}
                </Card>

                <Card n="03" title="Caras" missing={missing[3]} onEdit={edit("caras")}>
                    {faces.length > 0 ? (
                        <>
                            <Fill urls={faces.slice(0, 4).map((a) => a.imageUrl!)} faces />
                            <Note>{faces.slice(0, 4).map((a) => a.name.split(" ")[0]).join(" · ")}{b.voicePresets?.length ? ` · ${count(b.voicePresets.length, "voz", "voces")}` : ""}</Note>
                        </>
                    ) : <Empty>Sin avatares ni modelos. Sin caras, no hay video con personas.</Empty>}
                </Card>

                <Card n="04" title="Catálogo" missing={missing[4]} onEdit={edit("catalogo")}>
                    {catalog.length > 0 ? (
                        <>
                            <Fill urls={catalog.slice(0, 4)} />
                            <Note>{[count(b.products?.length, "producto", "productos"), count(b.clothing?.length, "prenda", "prendas")].filter(Boolean).join(" · ")}</Note>
                        </>
                    ) : <Empty>Sin productos ni prendas: no se pueden hacer fichas ni prenda sobre modelo.</Empty>}
                </Card>

                {!readOnly ? (
                    <Card n="05" title="Plantillas" missing={missing[5]}>
                        {b.carouselRefs?.length ? (
                            <>
                                <Fill urls={b.carouselRefs.slice(0, 4).map((x) => x.imageUrl)} small />
                                <Note>{count(b.carouselRefs.length, "referencia de carrusel", "referencias de carrusel")} (de un PDF de marca)</Note>
                            </>
                        ) : <Empty>Se guardan cuando una pieza se aprueba, para repetir el formato. Las referencias de carrusel de un PDF de marca también llegan acá.</Empty>}
                    </Card>
                ) : <div className="hidden md:block" />}
            </div>
            {agentOpen && <BrandAgentPanel brand={b} onClose={() => setAgentOpen(false)} onChanged={refreshBrands} />}
            {editing && <BrandBlockEditor brand={b} block={editing} onClose={() => setEditing(null)} onChanged={refreshBrands} />}
        </div>
    );
}
