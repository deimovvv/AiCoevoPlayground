import { useEffect, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, type Brand } from "../lib/api";
import { loadBrandFonts } from "../tools/shared/fontLoader";

/**
 * Marca — la entrada de Studio (openspec/changes/studio-v2 §1 y §7).
 *
 * La memoria de la marca como un registro: seis filas separadas por una línea fina, número en
 * mono, lo que hay y lo que falta. Es lo que Claude lee antes de producir (MCP `ver_marca`).
 * Diseño: la lámina "Criterio" de los carruseles de Coevo — filas, aire, color sólo donde importa.
 * Se edita en la pantalla de la marca de siempre (BrandSettings) hasta que cada bloque tenga la suya.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

const clip = (t: string | undefined, max: number) => {
    const s = (t || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
};

function Row({ n, title, missing, children, editTo }: {
    n: string; title: string; missing?: string | null; children: ReactNode; editTo: string;
}) {
    return (
        <section className="group grid grid-cols-[48px_200px_minmax(0,1fr)_120px] gap-x-6 py-7 border-t border-edge">
            <span className={`${mono} text-fg-faint pt-1`}>{n}</span>
            <h2 className="text-[15px] tracking-[-0.01em] text-fg pt-0.5">{title}</h2>
            <div className="min-w-0">{children}</div>
            <div className="flex flex-col items-end gap-2 pt-1">
                <span className={`${mono} ${missing ? "text-[var(--color-brand)]" : "text-fg-faint"}`}>{missing ? "Falta" : "Listo"}</span>
                <Link to={editTo} className="text-[12px] text-fg-faint no-underline opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity">Editar</Link>
            </div>
        </section>
    );
}

const count = (n: number | undefined, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");
const Note = ({ children }: { children: ReactNode }) => <p className="mt-2.5 text-[12px] leading-relaxed text-fg-muted max-w-[620px]">{children}</p>;
const Empty = ({ children }: { children: ReactNode }) => <p className="text-[14px] text-fg-faint">{children}</p>;

function Imgs({ urls, round }: { urls: string[]; round?: boolean }) {
    return (
        <div className="flex gap-2">
            {urls.map((u, i) => (
                <img key={i} src={backendUrl(u)} alt="" loading="lazy"
                    className={round ? "w-14 h-14 rounded-full object-cover" : "h-[112px] w-auto max-w-[180px] object-cover rounded-[2px]"} />
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
        looks: [...(b.moodboards || []), ...(b.lookAndFeel || []), ...(b.backgrounds || [])].map((x) => x.imageUrl),
        faces: (b.avatars || []).filter((a) => a.imageUrl),
        catalog: [...(b.products || []), ...(b.clothing || [])].map((x) => x.imageUrl),
    };
}

export function MarcaPage() {
    const { activeBrand, setActiveBrandId } = useBrand();
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

    if (!activeBrand) return <p className="text-[14px] text-fg-muted">Elegí una marca arriba para ver su memoria.</p>;
    const b = activeBrand;
    const { dna, ds, logo, colors, fonts: fontNames, looks, faces, catalog } = data(b);
    const edit = `/dashboard/brands/${b.id}`;
    const brandFont = b.fonts?.headline ? `"${b.fonts.headline}", ui-serif, serif` : undefined;

    const missing = [
        !b.brandContext ? "contexto" : null,
        !logo ? "logo" : !colors.length ? "colores" : null,
        !ds.photoStyle ? "reglas de foto" : !looks.length ? "referencias" : null,
        !faces.length ? "caras" : null,
        !catalog.length ? "catálogo" : null,
        "plantillas",
    ];
    const done = missing.filter((m) => !m).length;

    return (
        <div className="max-w-[1180px] mx-auto pt-4 pb-16">
            <header className="flex items-end gap-8 pb-10">
                <div className="min-w-0">
                    <p className={`${mono} text-fg-faint`}>Memoria de la marca · {done} de 6</p>
                    <h1 className="mt-3 text-[52px] leading-[0.95] tracking-[-0.04em] text-fg">{b.name}</h1>
                </div>
                <span className="flex-1" />
                <p className="max-w-[300px] text-[13px] leading-relaxed text-fg-muted hidden lg:block">
                    Lo que Claude lee antes de producir cualquier pieza para la marca.
                </p>
                <Link to={edit} className="shrink-0 h-10 px-4 flex items-center rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] no-underline">
                    Cargar material
                </Link>
            </header>

            <Row n="01" title="Quién es" missing={missing[0]} editTo={edit}>
                {b.brandContext || b.business?.value_prop
                    ? <p className="text-[17px] leading-[1.45] tracking-[-0.01em] text-fg max-w-[640px]">{clip(b.business?.value_prop || b.brandContext, 200)}</p>
                    : <Empty>Todavía no sabemos quién es la marca.</Empty>}
                {(dna.tone?.length || dna.forbidden_words?.length) ? (
                    <Note>
                        {dna.tone?.length ? <>Tono {dna.tone.slice(0, 3).join(", ").toLowerCase()}.</> : null}
                        {dna.forbidden_words?.length ? <> Nunca dice {dna.forbidden_words.slice(0, 3).map((w) => `«${w.toLowerCase()}»`).join(", ")}.</> : null}
                    </Note>
                ) : null}
            </Row>

            <Row n="02" title="Identidad gráfica" missing={missing[1]} editTo={edit}>
                <div className="flex items-center gap-10 flex-wrap">
                    {logo
                        ? <img src={backendUrl(logo)} alt={`Logo de ${b.name}`} className="h-12 w-auto max-w-[200px] object-contain" />
                        : <span className="text-[34px] leading-none text-fg" style={{ fontFamily: brandFont }}>{b.name}</span>}
                    {colors.length > 0 && (
                        <div className="flex">
                            {colors.slice(0, 6).map((c) => (
                                <span key={c.hex + c.name} title={`${c.name} · ${c.hex}`} style={{ background: c.hex }} className="w-7 h-12 first:rounded-l-[2px] last:rounded-r-[2px]" />
                            ))}
                        </div>
                    )}
                </div>
                <Note>
                    {fontNames.length ? fontNames.join(" / ") : "Sin tipografías"}
                    {colors.length ? <span className="font-mono text-[11px] text-fg-faint"> · {colors.slice(0, 4).map((c) => c.hex.toLowerCase()).join(" ")}</span> : null}
                    {!logo && <span className="text-[var(--color-brand)]"> · falta el logo</span>}
                </Note>
            </Row>

            <Row n="03" title="Dirección de foto y video" missing={missing[2]} editTo={edit}>
                {looks.length > 0 && <Imgs urls={looks.slice(0, 4)} />}
                {ds.photoStyle ? <Note>{clip(ds.photoStyle, 220)}</Note> : <Empty>Sin reglas de foto: Claude no sabe cómo se ve la marca.</Empty>}
            </Row>

            <Row n="04" title="Caras" missing={missing[3]} editTo={edit}>
                {faces.length > 0 ? (
                    <>
                        <Imgs urls={faces.slice(0, 6).map((a) => a.imageUrl!)} round />
                        <Note>{faces.slice(0, 6).map((a) => a.name.split(" ")[0]).join(", ")}{b.voicePresets?.length ? ` · ${b.voicePresets.length} voz` : ""}</Note>
                    </>
                ) : <Empty>Sin avatares ni modelos.</Empty>}
            </Row>

            <Row n="05" title="Catálogo" missing={missing[4]} editTo={edit}>
                {catalog.length > 0 ? (
                    <>
                        <Imgs urls={catalog.slice(0, 5)} />
                        <Note>{[count(b.products?.length, "producto", "productos"), count(b.clothing?.length, "prenda", "prendas")].filter(Boolean).join(" · ")}</Note>
                    </>
                ) : <Empty>Sin productos ni prendas: no se pueden hacer fichas ni prenda sobre modelo.</Empty>}
            </Row>

            <Row n="06" title="Plantillas" missing={missing[5]} editTo={edit}>
                <Empty>Se guardan cuando una pieza se aprueba, para repetir el formato.</Empty>
            </Row>
            <div className="border-t border-edge" />
        </div>
    );
}
