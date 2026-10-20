import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useConfirm } from "../../lib/useConfirm";
import { Loader2, Trash2, Upload, X } from "lucide-react";
import {
    backendUrl, updateBrand, uploadAvatar, deleteAvatar, uploadProduct, deleteProduct, uploadClothing, deleteClothing,
    uploadBackground, deleteBackground, uploadMoodboard, deleteMoodboard, uploadLookAndFeel, deleteLookAndFeel,
    uploadBrandLogo, deleteBrandLogo, uploadPose, deletePose, uploadShotRef, deleteShotRef, type Brand,
    listCampaigns, uploadCampaignInputs, deleteCampaignInput, type Campaign, type CampaignInput,
} from "../../lib/api";

/**
 * Editar un bloque de la memoria de la marca sin salir de Marca (studio-v2 §7): panel que abre al
 * costado (regla del repo: los selectores abren al costado, nunca hacia abajo).
 * Reusa las subidas de siempre del backend; reemplaza, de a poco, a la pantalla vieja de 13 categorías.
 */

export type BlockKey = "quien" | "identidad" | "foto" | "caras" | "catalogo" | "material";

const TITLES: Record<BlockKey, string> = {
    quien: "Quién es", identidad: "Identidad gráfica", foto: "Dirección de foto y video",
    caras: "Caras", catalogo: "Catálogo", material: "Cargar material",
};

/** Adónde puede ir una imagen, y con qué se sube. */
type Dest = "moodboard" | "luz" | "fondo" | "pose" | "plano" | "cara" | "prenda" | "producto" | "logo";
const DEST_LABEL: Record<Dest, string> = {
    moodboard: "Moodboard", luz: "Luz / look", fondo: "Locación / fondo", pose: "Pose", plano: "Plano / cámara", cara: "Cara (modelo)",
    prenda: "Prenda", producto: "Producto", logo: "Logo",
};
const nameOf = (f: File) => f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 60);

async function uploadTo(dest: Dest, brandId: string, f: File) {
    const n = nameOf(f);
    if (dest === "moodboard") return uploadMoodboard(brandId, n, f);
    if (dest === "luz") return uploadLookAndFeel(brandId, n, f);
    if (dest === "fondo") return uploadBackground(brandId, n, f);
    if (dest === "pose") return uploadPose(brandId, n, f);
    if (dest === "plano") return uploadShotRef(brandId, n, f);
    if (dest === "cara") return uploadAvatar(brandId, n, f, false);
    if (dest === "prenda") return uploadClothing(brandId, n, f);
    if (dest === "producto") return uploadProduct(brandId, n, f);
    return uploadBrandLogo(brandId, n, f);
}

/** Lo que la marca ya tiene en cada destino, y cómo se borra. */
function destItems(b: Brand, d: Dest): Array<{ id: string; url: string; label?: string }> {
    const map = (xs: Array<{ id: string; imageUrl?: string; name?: string }> | undefined) =>
        (xs || []).filter((x) => x.imageUrl).map((x) => ({ id: x.id, url: x.imageUrl!, label: x.name }));
    if (d === "moodboard") return map(b.moodboards);
    if (d === "luz") return map(b.lookAndFeel);
    if (d === "fondo") return map(b.backgrounds);
    if (d === "pose") return map(b.poses);
    if (d === "plano") return map(b.shotRefs);
    if (d === "cara") return map(b.avatars);
    if (d === "prenda") return map(b.clothing);
    if (d === "producto") return map(b.products);
    return map(b.logos);
}
const DEST_DELETE: Record<Dest, (brandId: string, itemId: string) => Promise<unknown>> = {
    moodboard: deleteMoodboard, luz: deleteLookAndFeel, fondo: deleteBackground, pose: deletePose, plano: deleteShotRef, cara: deleteAvatar,
    prenda: deleteClothing, producto: deleteProduct, logo: deleteBrandLogo,
};

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const input = "w-full px-3 py-2 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg outline-none focus:border-fg/40";

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2.5 py-5 border-t border-edge first:border-t-0 first:pt-0">
            <p className={`${mono} text-fg-faint`}>{title}</p>
            {children}
        </section>
    );
}

/** En un proyecto, cada destino es un tipo de input del proyecto (el logo no aplica). */
const CAMPAIGN_TYPE: Partial<Record<Dest, CampaignInput["type"]>> = {
    moodboard: "moodboard", luz: "lookfeel", fondo: "background", pose: "pose", plano: "plano",
    cara: "avatar", prenda: "clothing", producto: "product",
};

function Drop({ dests, brandId, onDone, hint, dest: destIn, onDest, campaignId }: {
    dests: Dest[]; brandId: string; onDone: () => Promise<void>; hint?: string; dest?: Dest; onDest?: (d: Dest) => void;
    /** Si viene, se sube al proyecto en vez de a la marca. */
    campaignId?: string | null;
}) {
    const [destOwn, setDestOwn] = useState<Dest>(dests[0]);
    const dest = destIn ?? destOwn;
    const setDest = (d: Dest) => { setDestOwn(d); onDest?.(d); };
    const [busy, setBusy] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [over, setOver] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    const send = async (files: FileList | null) => {
        const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
        if (!list.length) return;
        setErr(null);
        try {
            for (let i = 0; i < list.length; i++) {
                setBusy(`Subiendo ${i + 1} de ${list.length}…`);
                if (campaignId) await uploadCampaignInputs(campaignId, [list[i]], CAMPAIGN_TYPE[dest] ?? "reference");
                else await uploadTo(dest, brandId, list[i]);
            }
            await onDone();
        } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
    };
    return (
        <div className="flex flex-col gap-2">
            {dests.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    {dests.map((d) => (
                        <button key={d} type="button" onClick={() => setDest(d)}
                            className={`h-7 px-2.5 rounded-full border text-[12px] cursor-pointer ${dest === d ? "border-fg bg-fg text-[var(--color-canvas)]" : "border-edge text-fg-muted hover:text-fg"}`}>
                            {DEST_LABEL[d]}
                        </button>
                    ))}
                </div>
            )}
            <button type="button" onClick={() => ref.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}
                className={`h-28 rounded-[4px] border border-dashed flex flex-col items-center justify-center gap-1.5 text-[13px] cursor-pointer transition-colors ${over ? "border-fg bg-[var(--color-surface-2)]" : "border-[var(--color-edge-strong)] text-fg-muted hover:text-fg"}`}>
                {busy ? <><Loader2 size={16} className="animate-spin" /> {busy}</> : <><Upload size={16} /> Soltá imágenes acá o tocá para elegir</>}
                <span className="text-[11px] text-fg-faint">{hint ?? `Van a: ${DEST_LABEL[dest]}`}</span>
            </button>
            <input ref={ref} type="file" multiple accept="image/*" hidden onChange={(e) => { send(e.target.files); e.target.value = ""; }} />
            {err && <p className="text-[12px] text-[var(--color-error)]">{err}</p>}
        </div>
    );
}

function Grid({ items, onDelete }: { items: Array<{ id: string; url: string; label?: string }>; onDelete: (id: string) => Promise<void> }) {
    const [busy, setBusy] = useState<string | null>(null);
    const [dialog, ask] = useConfirm();
    if (!items.length) return null;
    return (
        <div className="grid grid-cols-3 gap-1.5">
            {dialog}
            {items.map((it) => (
                <figure key={it.id} className="group relative aspect-[4/5] rounded-[2px] overflow-hidden bg-[var(--color-surface-2)]">
                    <img src={backendUrl(it.url)} alt={it.label ?? ""} loading="lazy" className="w-full h-full object-cover" />
                    {it.label && <figcaption className="absolute left-1 bottom-1 px-1 rounded-[2px] bg-black/55 text-white text-[10px] max-w-[90%] truncate">{it.label}</figcaption>}
                    <button type="button" aria-label="Quitar" disabled={busy === it.id}
                        onClick={async () => { if (!(await ask({ title: "¿Quitar esta imagen?", confirm: "Quitar", danger: true }))) return; setBusy(it.id); try { await onDelete(it.id); } finally { setBusy(null); } }}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                        {busy === it.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                </figure>
            ))}
        </div>
    );
}

const lines = (a?: string[]) => (a || []).join("\n");
const fromLines = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

export function BrandBlockEditor({ brand, block, onClose, onChanged }: {
    brand: Brand; block: BlockKey; onClose: () => void; onChanged: () => Promise<void>;
}) {
    const id = brand.id;
    const dna = brand.dna || {};
    const ds = brand.designSystem || {};
    const [context, setContext] = useState(brand.brandContext || "");
    const [tone, setTone] = useState((dna.tone || []).join(", "));
    const [never, setNever] = useState((dna.forbidden_words || []).join(", "));
    const [colors, setColors] = useState(dna.colors || []);
    const [headline, setHeadline] = useState(brand.fonts?.headline || "");
    const [body, setBody] = useState(brand.fonts?.body || "");
    const [style, setStyle] = useState(ds.photoStyle || "");
    const [dos, setDos] = useState(lines(ds.visualDos));
    const [donts, setDonts] = useState(lines(ds.visualDonts));
    const [matDest, setMatDest] = useState<Dest>("moodboard");
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [target, setTarget] = useState("");   // "" = la marca; si no, id de campaña
    const reloadCampaigns = async () => setCampaigns(await listCampaigns(id).catch(() => []));
    useEffect(() => {
        if (block !== "material") return;
        let alive = true;
        listCampaigns(id).then((c) => alive && setCampaigns(c)).catch(() => {});
        return () => { alive = false; };
    }, [block, id]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const save = async (payload: Parameters<typeof updateBrand>[1]) => {
        setSaving(true); setErr(null);
        try { await updateBrand(id, payload); await onChanged(); onClose(); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
    };
    const del = (fn: (b: string, i: string) => Promise<unknown>) => async (itemId: string) => { await fn(id, itemId); await onChanged(); };

    const textBlock = block === "quien" || block === "identidad" || block === "foto";
    const onSave = () => {
        if (block === "quien") return save({ brandContext: context, dna: { ...dna, tone: fromLines(tone), forbidden_words: fromLines(never) } });
        if (block === "identidad") return save({ fonts: { ...brand.fonts, headline: headline || undefined, body: body || undefined }, dna: { ...dna, colors: colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex)) } });
        if (block === "foto") return save({ designSystem: { ...ds, photoStyle: style, visualDos: fromLines(dos), visualDonts: fromLines(donts) } });
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label={TITLES[block]}>
            <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25 cursor-default" />
            <aside className="relative w-full max-w-[480px] h-full bg-[var(--color-canvas)] border-l border-edge flex flex-col shadow-[var(--shadow-modal)]">
                <header className="h-16 shrink-0 flex items-center gap-3 px-6 border-b border-edge">
                    <div className="min-w-0">
                        <p className={`${mono} text-fg-faint`}>{brand.name}</p>
                        <h2 className="text-[17px] text-fg">{TITLES[block]}</h2>
                    </div>
                    <span className="flex-1" />
                    <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer"><X size={16} /></button>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {block === "material" && (() => {
                        const camp = campaigns.find((c) => c.id === target) || null;
                        const items = camp
                            ? (camp.inputs || []).filter((i) => i.type === CAMPAIGN_TYPE[matDest]).map((i) => ({ id: i.id, url: i.url, label: i.name }))
                            : destItems(brand, matDest);
                        const dests: Dest[] = camp
                            ? ["moodboard", "luz", "fondo", "plano", "pose", "cara", "prenda", "producto"]
                            : ["moodboard", "luz", "fondo", "pose", "plano", "cara", "prenda", "producto", "logo"];
                        return (
                            <>
                                <Section title="¿Para qué es?">
                                    <select value={target} onChange={(e) => setTarget(e.target.value)} className={input + " h-10 cursor-pointer"}>
                                        <option value="">La marca en general (vale para todo)</option>
                                        {campaigns.map((c) => <option key={c.id} value={c.id}>Proyecto · {c.name}</option>)}
                                    </select>
                                    <p className="text-[12px] text-fg-faint">{camp ? "Va al tablero de ese proyecto: gana en lo suyo cuando se produce el proyecto." : "Va a la memoria de la marca: lo que vale en cualquier proyecto."}</p>
                                </Section>
                                <Section title="Subir imágenes">
                                    <Drop dests={dests} brandId={id} onDone={async () => { await onChanged(); await reloadCampaigns(); }} dest={matDest} onDest={setMatDest} campaignId={camp?.id ?? null} />
                                </Section>
                                <Section title={`${DEST_LABEL[matDest]} · ${items.length} ${camp ? "en el proyecto" : "en la marca"}`}>
                                    {items.length
                                        ? <Grid items={items} onDelete={async (itemId) => {
                                            if (camp) { await deleteCampaignInput(camp.id, itemId); await reloadCampaigns(); }
                                            else { await DEST_DELETE[matDest](id, itemId); await onChanged(); }
                                        }} />
                                        : <p className="text-[13px] text-fg-faint">Todavía no hay nada acá.</p>}
                                </Section>
                            </>
                        );
                    })()}

                    {block === "quien" && (
                        <>
                            <Section title="Quién es la marca">
                                <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={9} className={input + " resize-y leading-relaxed"}
                                    placeholder="Qué hace, para quién, qué la hace distinta. Lo que Claude tiene que saber antes de escribir o producir." />
                            </Section>
                            <Section title="Tono (separado por comas)">
                                <input value={tone} onChange={(e) => setTone(e.target.value)} className={input} placeholder="ej. seco, frontal, con humor" />
                            </Section>
                            <Section title="Palabras que nunca usa">
                                <input value={never} onChange={(e) => setNever(e.target.value)} className={input} placeholder="ej. premium, innovador, experiencia única" />
                            </Section>
                        </>
                    )}

                    {block === "identidad" && (
                        <>
                            <Section title="Logo">
                                <Grid items={(brand.logos || []).map((l) => ({ id: l.id, url: l.imageUrl, label: l.name }))} onDelete={del(deleteBrandLogo)} />
                                <Drop dests={["logo"]} brandId={id} onDone={onChanged} hint="PNG o SVG con fondo transparente, si hay" />
                            </Section>
                            <Section title="Colores">
                                {colors.map((c, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"} aria-label={`Color ${i + 1}`}
                                            onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                                            className="w-9 h-9 rounded-[4px] border border-edge bg-transparent cursor-pointer" />
                                        <input value={c.hex} onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className={input + " w-28 font-mono"} aria-label="Código" />
                                        <input value={c.name} onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Nombre" aria-label="Nombre" />
                                        <button onClick={() => setColors(colors.filter((_, j) => j !== i))} aria-label="Quitar color" className="w-9 h-9 shrink-0 flex items-center justify-center text-fg-faint hover:text-[var(--color-error)] cursor-pointer"><Trash2 size={13} /></button>
                                    </div>
                                ))}
                                <button onClick={() => setColors([...colors, { name: "", hex: "#000000", usage: "" }])} className="self-start text-[12px] text-fg-muted hover:text-fg cursor-pointer">+ Sumar color</button>
                            </Section>
                            <Section title="Tipografías (nombre de Google Fonts)">
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-1 text-[12px] text-fg-muted">Títulos<input value={headline} onChange={(e) => setHeadline(e.target.value)} className={input} placeholder="ej. Playfair Display" /></label>
                                    <label className="flex flex-col gap-1 text-[12px] text-fg-muted">Textos<input value={body} onChange={(e) => setBody(e.target.value)} className={input} placeholder="ej. Inter" /></label>
                                </div>
                                <p className="text-[11px] text-fg-faint">Si la fuente es propia (con licencia), mandá el archivo: va al DESIGN.md de la marca.</p>
                            </Section>
                        </>
                    )}

                    {block === "foto" && (
                        <>
                            <Section title="Imágenes de referencia">
                                <Grid items={[
                                    ...(brand.moodboards || []).map((m) => ({ id: "m:" + m.id, url: m.imageUrl, label: "moodboard" })),
                                    ...(brand.lookAndFeel || []).map((m) => ({ id: "l:" + m.id, url: m.imageUrl, label: "luz" })),
                                    ...(brand.backgrounds || []).map((m) => ({ id: "b:" + m.id, url: m.imageUrl, label: "locación" })),
                                    ...(brand.poses || []).map((m) => ({ id: "p:" + m.id, url: m.imageUrl, label: "pose" })),
                                    ...(brand.shotRefs || []).map((m) => ({ id: "s:" + m.id, url: m.imageUrl, label: "plano" })),
                                ]} onDelete={async (key) => {
                                    const [k, itemId] = [key.slice(0, 1), key.slice(2)];
                                    const fn = { m: deleteMoodboard, l: deleteLookAndFeel, b: deleteBackground, p: deletePose, s: deleteShotRef }[k]!;
                                    await fn(id, itemId);
                                    await onChanged();
                                }} />
                                <Drop dests={["moodboard", "luz", "fondo", "pose", "plano"]} brandId={id} onDone={onChanged} />
                            </Section>
                            <Section title="Cómo se ve la marca">
                                <textarea value={style} onChange={(e) => setStyle(e.target.value)} rows={5} className={input + " resize-y leading-relaxed"}
                                    placeholder="Flash directo, oficina de noche, color frío, grano…" />
                            </Section>
                            <div className="grid grid-cols-2 gap-3">
                                <Section title="Siempre (una por línea)"><textarea value={dos} onChange={(e) => setDos(e.target.value)} rows={5} className={input + " resize-y"} /></Section>
                                <Section title="Nunca (una por línea)"><textarea value={donts} onChange={(e) => setDonts(e.target.value)} rows={5} className={input + " resize-y"} /></Section>
                            </div>
                        </>
                    )}

                    {block === "caras" && (
                        <Section title="Modelos y avatares">
                            <Grid items={(brand.avatars || []).filter((a) => a.imageUrl).map((a) => ({ id: a.id, url: a.imageUrl!, label: a.name }))} onDelete={del(deleteAvatar)} />
                            <Drop dests={["cara"]} brandId={id} onDone={onChanged} hint="Una foto clara de la cara por persona. El nombre sale del archivo." />
                        </Section>
                    )}

                    {block === "catalogo" && (
                        <>
                            <Section title="Prendas">
                                <Grid items={(brand.clothing || []).map((c) => ({ id: c.id, url: c.imageUrl, label: c.name }))} onDelete={del(deleteClothing)} />
                            </Section>
                            <Section title="Productos">
                                <Grid items={(brand.products || []).map((c) => ({ id: c.id, url: c.imageUrl, label: c.name }))} onDelete={del(deleteProduct)} />
                            </Section>
                            <Section title="Sumar">
                                <Drop dests={["prenda", "producto"]} brandId={id} onDone={onChanged} />
                            </Section>
                        </>
                    )}
                    {err && <p className="text-[12px] text-[var(--color-error)] mt-3">{err}</p>}
                </div>

                <footer className="h-16 shrink-0 flex items-center gap-3 px-6 border-t border-edge">
                    <Link to={`/dashboard/brands/${id}`} className="text-[12px] text-fg-faint hover:text-fg no-underline">Configuración completa</Link>
                    <span className="flex-1" />
                    {textBlock ? (
                        <>
                            <button onClick={onClose} className="h-9 px-3 text-[13px] text-fg-muted cursor-pointer">Cancelar</button>
                            <button onClick={onSave} disabled={saving}
                                className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-50">
                                {saving ? "Guardando…" : "Guardar"}
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer">Listo</button>
                    )}
                </footer>
            </aside>
        </div>
    );
}
