import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, sendMaterial, type Brand } from "../lib/api";
import { loadBrandFonts } from "../tools/shared/fontLoader";
import { BrandBlockEditor, type BlockKey } from "../components/workspace/BrandBlockEditor";
import { BrandAgentPanel } from "../components/workspace/BrandAgentPanel";
import { Lightbox } from "../components/Lightbox";
import { approveBrandBlock } from "../lib/api";
import { MiniMarkdown, plainText } from "../components/workspace/MiniMarkdown";

/**
 * Marca — la ficha de una marca (openspec/changes/studio-v2 §1, §7 y M.14).
 *
 * A la izquierda la marca como portada (nombre en su tipografía, colores, logo, archivos) y **qué le
 * falta**, cada cosa con su acción. A la derecha, primero lo que la marca **es** —quién es, cómo habla—,
 * después cómo se ve, su estrategia y, abajo y chico, con qué se produce (productos, personas, formatos).
 * Antes eran seis bloques de moda (caras, prendas, plantillas) que marcaban «FALTA» en rojo a cualquier
 * marca que no los usara (2026-10-31, Gonzalo: «hay algo que no me cierra»).
 * Es lo que Claude lee antes de producir (MCP `ver_marca`).
 * `readOnly`: «Mi marca» del cliente (sin editar ni cargar; sólo lo que tiene).
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

const clip = (t: string | undefined, max: number) => {
    const s = (t || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
};
const count = (n: number | undefined, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");

function Card({ n, title, hint, missing, children, onEdit, className = "", proposed, onApprove }: {
    n?: string; title: string; missing?: string | true | null; children: ReactNode; onEdit?: () => void; className?: string;
    /** Para qué sirve el bloque, en una línea: que se entienda sin explicarlo. */
    hint?: string;
    /** Lo propuso el agente y nadie lo revisó todavía. */
    proposed?: boolean; onApprove?: () => void;
}) {
    return (
        <section className={`group relative flex flex-col gap-4 p-5 rounded-[var(--radius-md)] border border-edge bg-[var(--color-surface-1)] min-w-0 min-h-0 overflow-hidden transition-[border-color,box-shadow] duration-200 ${onEdit ? "hover:border-[var(--color-edge-strong)] hover:shadow-[var(--shadow-dropdown)]" : ""} ${className}`}>
            {/* Todo el bloque abre su edición (panel al costado). */}
            {onEdit && <button onClick={onEdit} aria-label={`Editar ${title}`} className="absolute inset-0 z-10 cursor-pointer" />}
            <div className="flex items-baseline gap-3 shrink-0">
                {n && <span className={`${mono} text-fg-faint`}>{n}</span>}
                <span className="min-w-0">
                    <h2 className={`${mono} text-fg-muted`}>{title}</h2>
                    {hint && <p className="mt-0.5 text-[12px] text-fg-faint leading-snug">{hint}</p>}
                </span>
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

/** Imágenes que llenan el espacio del bloque (en celular, un alto fijo). Tocar una la abre en grande
 *  y se recorren todas las del grupo (`all`), no sólo las que entran en la tarjeta. */
function Fill({ urls, all, faces, small }: { urls: string[]; all?: string[]; faces?: boolean; small?: boolean }) {
    const [open, setOpen] = useState<number | null>(null);
    const list = (all?.length ? all : urls).map((u) => ({ url: backendUrl(u) }));
    return (
        <>
        {open !== null && <div onClick={(e) => e.stopPropagation()}><Lightbox items={list} index={open} onNavigate={setOpen} onClose={() => setOpen(null)} /></div>}
        <div className={`flex-1 ${small ? "min-h-[110px]" : "min-h-[200px]"} md:min-h-0 grid gap-1.5 overflow-hidden`}
            style={{ gridTemplateColumns: `repeat(${urls.length}, minmax(0, 1fr))`, gridTemplateRows: "minmax(0, 1fr)" }}>
            {urls.map((u, i) => (
                <img key={i} src={backendUrl(u)} alt="" loading="lazy" title="Ver en grande"
                    onClick={(e) => { e.stopPropagation(); setOpen(i); }}
                    className={`w-full h-full object-cover rounded-[2px] cursor-zoom-in ${faces ? "object-top" : ""}`} />
            ))}
        </div>
        </>
    );
}

const fromPinterest = (x: { source?: string }) => /pinterest\.|pin\.it\//i.test(x.source ?? "");

function data(b: Brand, readOnly: boolean) {
    const dna = b.dna || {};
    const ds = b.designSystem || {};
    // Lo traído de Pinterest es materia prima del equipo. El servidor ya se lo saca al cliente; esto es para la vista previa.
    const own = <T extends { source?: string }>(list?: T[]) => (list || []).filter((x) => !readOnly || !fromPinterest(x));
    const moodboards = own(b.moodboards), lookAndFeel = own(b.lookAndFeel), backgrounds = own(b.backgrounds);
    return {
        dna, ds,
        logo: b.logo?.imageUrl || b.logos?.[0]?.imageUrl,
        colors: dna.colors || [],
        fonts: [...new Set([b.fonts?.headline, b.fonts?.body, b.fonts?.accent].filter(Boolean) as string[])],
        looks: [...moodboards, ...lookAndFeel, ...backgrounds, ...(b.poses || []), ...(b.shotRefs || [])].map((x) => x.imageUrl).filter((u, i, a) => u && a.indexOf(u) === i),
        // Separado como en un tablero de dirección: moodboard · luz · locación.
        lookGroups: [
            // Un moodboard por tablero (ej. uno traído de Pinterest); las sueltas, juntas.
            ...[...new Set(moodboards.map((x) => x.board ?? ""))].sort((x, y) => (x === "" ? 1 : y === "" ? -1 : x.localeCompare(y)))
                .map((k) => ({ label: k ? `Moodboard · ${k}` : "Moodboard", urls: moodboards.filter((x) => (x.board ?? "") === k).map((x) => x.imageUrl) })),
            { label: "Luz / look", urls: lookAndFeel.map((x) => x.imageUrl) },
            { label: "Locación", urls: backgrounds.map((x) => x.imageUrl) },
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
    // «Subir PDF de marca»: lo manda a la Bandeja, que lo parte en páginas y el agente lo ordena.
    const navigate = useNavigate();
    const pdfRef = useRef<HTMLInputElement>(null);
    const [pdfUp, setPdfUp] = useState<number | null>(null);
    const [pdfErr, setPdfErr] = useState<string | null>(null);
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
    const { dna, ds, logo, colors, fonts: fontNames, looks, lookGroups, faces, catalog } = data(b, !!readOnly);
    const edit = (k: BlockKey) => (readOnly ? undefined : () => setEditing(k));
    const brandFont = b.fonts?.headline ? `"${b.fonts.headline}", ui-serif, serif` : undefined;
    const proposed = (k: string) => !readOnly && b.agent?.blocks?.[k] === "propuesto";
    const approve = (k: string) => async () => { await approveBrandBlock(b.id, k); await refreshBrands(); };
    const plan = b.workType === "plan";
    const oneLine = b.business?.value_prop || (b.brandContext ? plainText(b.brandContext) : "");
    const formats = b.carouselRefs || [];
    // El cliente no ve alarmas ni bloques vacíos: sólo lo que ya sabemos de su marca.
    const miss = (v: true | null) => (readOnly ? null : v);
    const speaks = !!(dna.tone?.length || dna.forbidden_words?.length);
    const showStrategy = !readOnly || !!b.strategy?.claim || !!b.learnedRules?.length;

    // Lo que le falta para que Claude produzca bien, en orden. Sólo lo que toda marca necesita;
    // productos, personas y formatos no son obligatorios (una clínica no tiene prendas).
    const pdfLabel = pdfUp === null ? "Subir PDF" : pdfUp < 1 ? `Subiendo ${Math.round(pdfUp * 100)}%` : "Separando…";
    const todo: { label: string; why: string; done: boolean; actions: { label: string; run: () => void }[] }[] = [
        { label: "Quién es", why: "qué hace, a quién le habla", done: !!b.brandContext,
            actions: [{ label: "Armar con el agente", run: () => setAgentOpen(true) }, { label: "Escribir", run: () => setEditing("quien") }] },
        { label: "Cómo habla", why: "tono y palabras que nunca usa", done: !!(dna.tone?.length || dna.forbidden_words?.length),
            actions: [{ label: "Completar", run: () => setEditing("quien") }] },
        { label: "Logo y colores", why: "para que cada pieza sea de la marca", done: !!logo && colors.length > 0,
            actions: [{ label: pdfLabel, run: () => pdfRef.current?.click() }, { label: "Cargar", run: () => setEditing("identidad") }] },
        { label: "Cómo se ve", why: "reglas de foto", done: !!ds.photoStyle,
            actions: [{ label: "Escribir reglas", run: () => setEditing("foto") }] },
        ...(plan ? [{ label: "Estrategia", why: "ángulos y calendario del plan", done: !!b.strategy?.claim,
            actions: [] as { label: string; run: () => void }[] }] : []),
    ];
    const pending = todo.filter((t) => !t.done);
    // El servidor ya filtra para el cliente; esto hace que la vista previa muestre lo mismo.
    // El design system tiene su propia fila: no se repite en Archivos, y el cliente no lo ve.
    const links = (b.workLinks || []).filter((l) => l.kind !== "design-system" && (!readOnly || l.client));
    // Referencias: se piden una vez y son opcionales; no cuentan para «Para completar» ni frenan nada.
    const hasRefs = !!b.workLinks?.some((l) => l.kind === "referencias") || looks.length > 0;
    const btn = "h-8 px-3 inline-flex items-center rounded-[var(--radius-md)] border border-edge text-[12.5px] text-fg bg-[var(--color-surface-1)] hover:border-[var(--color-edge-strong)] hover:bg-[var(--color-surface-2)] cursor-pointer transition-colors disabled:opacity-60";

    return (
        <div className="md:h-full md:grid md:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
            {/* ── La marca como portada ── */}
            <aside className="flex flex-col gap-8 p-6 md:p-10 border-b md:border-b-0 md:border-r border-edge md:min-h-0 md:overflow-y-auto">
                <p className={`${mono} text-fg-faint`}>{readOnly ? "Así te entendemos" : `Memoria de la marca · ${plan ? "plan mensual" : "proyectos"}`}</p>

                <div className="flex flex-col gap-6">
                    {logo && <img src={backendUrl(logo)} alt={`Logo de ${b.name}`} className="h-16 w-auto max-w-[240px] object-contain self-start p-2 rounded-[3px] bg-[#f4f3f0]" />}
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
                            <button onClick={approve("identidad")} className={btn}>Aprobar</button>
                        </p>
                    )}
                    <dl className="grid grid-cols-[96px_1fr] gap-y-2 text-[13px]">
                        <dt className="text-fg-faint">Tipografía</dt>
                        <dd className="text-fg">{fontNames.length ? fontNames.join(" / ") : <span className="text-fg-faint">sin cargar</span>}</dd>
                        {/* El design system es de Coevo (Claude Design): el cliente no lo ve. */}
                        {!readOnly && <><dt className="text-fg-faint">Design system</dt>
                            <dd>{b.designSystemUrl
                                ? <a href={b.designSystemUrl} target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2">abrir en Claude ↗</a>
                                : <span className="text-fg-faint">sin armar</span>}</dd></>}
                        {/* Archivos de trabajo: el cliente recibe sólo los que se le marcaron (backend). */}
                        {(links.length || !readOnly) ? <><dt className="text-fg-faint">Archivos</dt>
                            <dd className="flex flex-col gap-1 min-w-0">
                                {links.map((l) => (
                                    <a key={l.id || l.url} href={l.url} target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2 truncate">
                                        {l.title} ↗{!readOnly && !l.client && <span className="no-underline text-fg-faint"> · sólo equipo</span>}
                                    </a>
                                ))}
                                {!readOnly && <button onClick={() => setEditing("archivos")} className="self-start text-fg-muted hover:text-fg cursor-pointer text-[12px]">
                                    {b.workLinks?.length ? "Editar" : "+ Sumar links"}
                                </button>}
                            </dd></> : null}
                        {!readOnly && <><dt className="text-fg-faint">Identidad</dt>
                            <dd><button onClick={() => setEditing("identidad")} className="text-fg-muted hover:text-fg cursor-pointer text-[12px]">Editar logo, colores y letras</button></dd></>}
                    </dl>
                </div>

                {/* ── Qué le falta: una lista con su acción, no un contador ── */}
                {!readOnly && (
                    <section className="md:mt-auto flex flex-col">
                        <div className="flex items-baseline justify-between pb-2 border-b border-edge">
                            <p className={`${mono} text-fg-muted`}>{pending.length ? "Para completar" : "Completa"}</p>
                            <span className="font-mono text-[11px] text-fg-faint">{todo.length - pending.length} de {todo.length}</span>
                        </div>
                        {pending.length === 0 && <p className="py-3 text-[13px] text-fg-muted">Claude tiene lo que necesita para producir. Lo que sumes mejora la próxima pieza.</p>}
                        {pending.map((t) => (
                            <div key={t.label} className="py-3 border-b border-edge flex flex-col gap-2">
                                <p className="text-[13.5px] text-fg">{t.label} <span className="text-fg-faint">· {t.why}</span></p>
                                {t.actions.length > 0
                                    ? <div className="flex flex-wrap gap-1.5">{t.actions.map((a) => <button key={a.label} onClick={a.run} disabled={a.label === pdfLabel && pdfUp !== null} className={btn}>{a.label}</button>)}</div>
                                    : <p className="text-[12px] text-fg-faint">La arma Dirección (auditoría → mercado → spec) y Claude la carga.</p>}
                            </div>
                        ))}
                        {!hasRefs && (
                            <div className="py-3 border-b border-edge flex flex-col gap-2">
                                <p className="text-[13.5px] text-fg">Referencias <span className="text-fg-faint">· opcional · imágenes que les gustan</span></p>
                                <p className="text-[12px] text-fg-faint">«Traer imágenes» las copia a Studio. «Guardar link» deja sólo el link, para Drive u otro lugar.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <button onClick={() => setEditing("material")} className={btn}>Traer imágenes</button>
                                    <button onClick={() => setEditing("archivos")} className={btn}>Guardar link</button>
                                </div>
                            </div>
                        )}
                        {todo.length - pending.length > 0 && pending.length > 0 && (
                            <p className="pt-2.5 text-[12px] text-fg-faint">Listo: {todo.filter((t) => t.done).map((t) => t.label.toLowerCase()).join(", ")}.</p>
                        )}
                        <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (!f || !activeBrand) return;
                            setPdfErr(null); setPdfUp(0);
                            try {
                                await sendMaterial(activeBrand.id, { files: [f], note: `PDF de marca: ${f.name}` }, setPdfUp);
                                navigate(`/dashboard/bandeja?marca=${activeBrand.id}`);
                            } catch (err) { setPdfErr((err as Error).message); } finally { setPdfUp(null); }
                        }} />
                        {pdfErr && <p className="mt-2 text-[12px] text-[var(--color-error)]">{pdfErr}</p>}
                        {pending.length === 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                <button onClick={() => setAgentOpen(true)} className={btn}>Actualizar con el agente</button>
                                <button onClick={() => pdfRef.current?.click()} className={btn}>{pdfLabel}</button>
                                <button onClick={() => setEditing("material")} className={btn}>Sumar material</button>
                            </div>
                        )}
                    </section>
                )}
                {readOnly && <p className="md:mt-auto text-[13px] leading-relaxed text-fg-muted">Es lo que usamos para producir cada pieza. Si algo no está bien, avisanos.</p>}
            </aside>

            {/* ── La memoria: primero lo que la marca es ── */}
            <div className="p-3 md:p-4 flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-y-auto [&>*]:shrink-0">
                <div className={`grid gap-3 ${speaks || !readOnly ? "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}>
                    <Card title="Quién es" missing={miss(!b.brandContext ? true : null)} onEdit={edit("quien")} proposed={proposed("quien")} onApprove={approve("quien")}>
                        {oneLine
                            ? <p className="text-[19px] leading-[1.4] tracking-[-0.012em] text-fg">{clip(oneLine, 220)}</p>
                            : <Empty>Todavía no sabemos quién es la marca.</Empty>}
                        {dna.audience && <Note><span className="text-fg-faint">Le habla a </span>{clip(dna.audience.charAt(0).toLowerCase() + dna.audience.slice(1), 140)}</Note>}
                        {b.brandContext && b.brandContext.length > 260 && (
                            <details className="relative z-20 group/more" onClick={(e) => e.stopPropagation()}>
                                <summary className="list-none cursor-pointer text-[12px] text-fg-muted hover:text-fg">Leer todo ↓</summary>
                                <MiniMarkdown text={b.brandContext} className="mt-3 text-[13.5px] leading-relaxed text-fg-muted max-w-[68ch]" />
                            </details>
                        )}
                    </Card>
                    {(speaks || !readOnly) && <Card title="Cómo habla" missing={miss(!speaks ? true : null)} onEdit={edit("quien")}>
                        {dna.tone?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                                {dna.tone.slice(0, 6).map((t) => <span key={t} className="h-7 px-2.5 inline-flex items-center rounded-full border border-edge text-[12.5px] text-fg">{t.toLowerCase()}</span>)}
                            </div>
                        ) : <Empty>Sin tono definido.</Empty>}
                        {dna.forbidden_words?.length ? (
                            <div>
                                <p className={`${mono} text-fg-faint`}>Nunca dice</p>
                                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{dna.forbidden_words.slice(0, 8).map((w) => `«${w.toLowerCase()}»`).join(" · ")}</p>
                            </div>
                        ) : null}
                    </Card>}
                </div>

                {(!readOnly || ds.photoStyle || looks.length > 0) && <Card title="Cómo se ve" missing={miss(!ds.photoStyle && !looks.length ? true : null)} onEdit={edit("foto")} proposed={proposed("foto")} onApprove={approve("foto")}>
                    {ds.photoStyle ? <p className="text-[15px] leading-relaxed text-fg max-w-[80ch]">{clip(ds.photoStyle, 260)}</p>
                        : <Empty>Sin reglas de foto: Claude no sabe cómo se ve la marca.</Empty>}
                    {looks.length > 0 && <div className="h-[220px] flex flex-col"><Fill urls={looks.slice(0, 7)} all={looks} /></div>}
                    {lookGroups.length > 0 && <Note>{lookGroups.map((g) => `${g.label} ${g.urls.length}`).join(" · ")}</Note>}
                </Card>}

                {/* Estrategia y lo aprendido: qué dice la marca este mes y qué ya no hay que corregirle. */}
                {showStrategy && <Card title="Estrategia y lo aprendido"
                    hint={readOnly ? undefined : plan ? "Plan mensual: cada pieza responde a un ángulo y va al calendario." : "Por proyectos: la estrategia es contexto; cada proyecto es su propio ángulo."}
                    missing={miss(plan && !b.strategy?.claim ? true : null)}>
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                        <div className="min-w-0">
                            {b.strategy?.claim ? (
                                <>
                                    <p className="text-[20px] leading-tight tracking-[-0.02em] text-fg">{b.strategy.claim}{b.strategy.hashtag && <span className="text-fg-muted"> {b.strategy.hashtag}</span>}</p>
                                    {b.strategy.enemy && <Note>Contra: {clip(b.strategy.enemy, 140)}</Note>}
                                    {!!b.strategy.angles?.length && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {b.strategy.angles.map((a) => (
                                                <span key={a.name} title={a.purpose} className="h-6 px-2 inline-flex items-center rounded-full border border-edge text-[11px] text-fg-muted">{a.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : <Empty>{plan ? "Sin estrategia: la arma Dirección (auditoría → mercado → spec de campaña) y Claude la carga." : "Sin estrategia cargada. En proyectos no hace falta: cada encargo trae su brief."}</Empty>}
                        </div>
                        <div className="min-w-0">
                            <p className={`${mono} text-fg-faint`}>Reglas aprendidas · {b.learnedRules?.length ?? 0}</p>
                            {b.learnedRules?.length ? (
                                <ul className="mt-2 flex flex-col gap-1.5">
                                    {b.learnedRules.slice(0, 4).map((r, i) => <li key={i} className="text-[13px] text-fg leading-snug">— {r.text}</li>)}
                                </ul>
                            ) : <p className="mt-2 text-[13px] text-fg-faint leading-relaxed">{readOnly ? "Todavía ninguna." : "Lo que la marca corrige tres veces se vuelve regla. Se ve en Entregas → Aprendizaje."}</p>}
                        </div>
                    </div>
                </Card>}

                {/* ── Con qué se produce: sólo lo que la marca tiene; lo que no, se suma sin alarma ── */}
                <section className="grid gap-3 md:grid-cols-3">
                    {[
                        { k: "catalogo" as BlockKey, title: "Productos o servicios", urls: catalog, sub: [count(b.products?.length, "producto", "productos"), count(b.clothing?.length, "prenda", "prendas")].filter(Boolean).join(" · "), empty: "Para fichas y piezas de producto." },
                        { k: "caras" as BlockKey, title: "Personas", urls: faces.map((a) => a.imageUrl!), sub: faces.slice(0, 3).map((a) => a.name.split(" ")[0]).join(" · ") + (b.voicePresets?.length ? ` · ${count(b.voicePresets.length, "voz", "voces")}` : ""), empty: "Caras con permiso, para video con personas.", faces: true },
                        ...(!readOnly ? [{ k: "plantillas" as BlockKey, title: "Formatos aprobados", urls: formats.map((x) => x.imageUrl), sub: count(formats.length, "formato", "formatos"), empty: "Lo aprobado que se repite igual (carruseles, placas)." }] : []),
                    ].filter((t) => !readOnly || t.urls.length).map((t) => (
                        <Card key={t.title} title={t.title} onEdit={edit(t.k)}>
                            {t.urls.length > 0 ? (
                                <>
                                    <div className="h-[120px] flex flex-col"><Fill urls={t.urls.slice(0, 3)} all={t.urls} faces={"faces" in t && t.faces} small /></div>
                                    <Note>{t.sub}</Note>
                                </>
                            ) : (
                                <>
                                    <p className="text-[13px] leading-relaxed text-fg-faint">{t.empty}</p>
                                    {!readOnly && <span className="text-[12.5px] text-fg-muted">+ Sumar</span>}
                                </>
                            )}
                        </Card>
                    ))}
                </section>
            </div>
            {agentOpen && <BrandAgentPanel brand={b} onClose={() => setAgentOpen(false)} onChanged={refreshBrands} />}
            {editing && <BrandBlockEditor brand={b} block={editing} onClose={() => setEditing(null)} onChanged={refreshBrands} />}
        </div>
    );
}
