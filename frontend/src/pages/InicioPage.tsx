import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useMe } from "../lib/useMe";
import { backendUrl, getInicio, type Inicio, type InicioBrand, type InicioTask } from "../lib/api";
import { cn } from "../lib/utils";

/**
 * Inicio del equipo (2026-10-31): lo primero al entrar. Antes se caía en la Marca de la última marca
 * abierta —una ficha llena de «FALTA»— y lo que pasaba entre marcas estaba en el Resumen (admin, con plata).
 * Arriba lo que te toca hoy; abajo las marcas con sus fotos, agrupadas como en el selector.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const GROUPS: { id: InicioBrand["group"]; label: string; hint: string }[] = [
    { id: "plan", label: "Plan mensual", hint: "contenido todos los meses · calendario" },
    { id: "proyectos", label: "Proyectos", hint: "encargos y campañas" },
    { id: "cargar", label: "Por cargar", hint: "todavía sin ficha" },
];
const KIND: Record<InicioTask["kind"], string> = {
    cambios: "Le toca a Coevo", material: "Material nuevo", sin_mandar: "Sin mandar", esperando: "Espera al cliente",
};

function greeting(name?: string | null) {
    const h = new Date().getHours();
    const g = h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
    return name ? `${g}, ${name.split(" ")[0]}` : g;
}

function brandLine(b: InicioBrand): string {
    if (b.next) return `Sale: ${b.next.title} · ${new Date(b.next.at).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}`;
    const parts = [
        b.changes ? `${b.changes} con cambios` : "", b.newMaterial ? `${b.newMaterial} material nuevo` : "",
        b.waiting ? `${b.waiting} esperando al cliente` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" · ");
    if (!b.pieces) return "Sin piezas todavía";
    return `${b.pieces} ${b.pieces === 1 ? "pieza" : "piezas"}${b.approvedThisMonth ? ` · ${b.approvedThisMonth} aprobadas este mes` : ""}`;
}

/** Las tapas en mosaico: una grande y hasta tres chicas. Sin fotos, el logo o la inicial. */
function Mosaic({ b }: { b: InicioBrand }) {
    const [main, ...rest] = b.covers;
    if (!main) {
        return (
            <div className="aspect-[4/3] flex items-center justify-center bg-[var(--color-surface-2)]">
                {b.logo ? <img src={backendUrl(b.logo)} alt="" className="max-w-[40%] max-h-[40%] object-contain" />
                    : <span className="text-[44px] font-light tracking-[-0.04em] text-fg-faint">{b.name.slice(0, 1)}</span>}
            </div>
        );
    }
    return (
        <div className={cn("aspect-[4/3] grid gap-px bg-[var(--color-edge)] overflow-hidden", rest.length ? "grid-cols-[2fr_1fr]" : "grid-cols-1")}>
            <img src={backendUrl(main)} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            {rest.length > 0 && (
                <div className="grid gap-px" style={{ gridTemplateRows: `repeat(${rest.length}, minmax(0,1fr))` }}>
                    {rest.map((u) => <img key={u} src={backendUrl(u)} alt="" className="w-full h-full object-cover min-h-0" />)}
                </div>
            )}
        </div>
    );
}

export function InicioPage() {
    const me = useMe();
    const { setActiveBrandId } = useBrand();
    const navigate = useNavigate();
    const [data, setData] = useState<Inicio | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        getInicio().then((d) => alive && setData(d)).catch((e) => alive && setErr((e as Error).message));
        return () => { alive = false; };
    }, []);

    const go = (brandId: string, href: string) => { setActiveBrandId(brandId); navigate(href); };
    const date = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 md:px-12 py-10 md:py-14 max-w-[1600px]">
                <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                        <p className={`${mono} text-fg-faint`}>Inicio · {date}</p>
                        <h1 className="mt-5 text-[40px] md:text-[54px] leading-[0.98] font-light tracking-[-0.045em] text-fg">{greeting(me.name)}.</h1>
                        <p className="mt-3 text-[17px] text-fg-muted">
                            {data === null ? " " : data.todayTotal ? `${data.todayTotal} ${data.todayTotal === 1 ? "cosa espera" : "cosas esperan"} a Coevo o se están demorando.` : "Nada urgente: todo al día."}
                        </p>
                    </div>
                    <Link to="/dashboard/brands" className="h-10 px-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-edge text-[13px] text-fg no-underline hover:border-[var(--color-edge-strong)] hover:bg-[var(--color-surface-1)] transition-colors">
                        <Plus size={14} /> Nueva marca
                    </Link>
                </div>

                {err && <p className="mt-8 text-[13px] text-[var(--color-error)]">{err}</p>}

                {data && data.today.length > 0 && (
                    <section className="mt-12">
                        <p className={`${mono} text-fg-faint pb-3`}>Te toca</p>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 border-t border-edge">
                            {data.today.map((t, i) => (
                                <button key={i} onClick={() => go(t.brandId, t.href)}
                                    className="group flex items-center gap-4 py-3 px-2 border-b border-edge text-left cursor-pointer hover:bg-[var(--color-surface-1)] transition-colors">
                                    <span className="w-11 h-14 shrink-0 rounded-[2px] overflow-hidden bg-[var(--color-surface-2)]">
                                        {t.cover && <img src={backendUrl(t.cover)} alt="" className="w-full h-full object-cover" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.urgency === 0 ? "bg-[var(--color-error)]" : t.urgency === 1 ? "bg-[var(--color-brand)]" : "bg-[var(--color-warning)]")} />
                                            <span className={`${mono} text-fg-faint`}>{t.brandName} · {KIND[t.kind]}</span>
                                        </span>
                                        <span className="block mt-1 text-[14px] text-fg truncate">{t.title}</span>
                                        <span className="block text-[12px] text-fg-faint truncate">{t.detail}</span>
                                    </span>
                                    <ArrowRight size={14} className="shrink-0 text-fg-faint group-hover:text-fg" />
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {data && GROUPS.map((g) => {
                    const list = data.brands.filter((b) => b.group === g.id);
                    if (!list.length) return null;
                    const small = g.id === "cargar";
                    return (
                        <section key={g.id} className="mt-14">
                            <div className="flex items-baseline gap-3 pb-4 border-b border-edge">
                                <h2 className="text-[20px] text-fg">{g.label}</h2>
                                <span className="text-[13px] text-fg-faint">{g.hint}</span>
                                <span className={`${mono} ml-auto text-fg-faint`}>{list.length}</span>
                            </div>
                            <div className={cn("mt-5 grid gap-5", small ? "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]")}>
                                {list.map((b) => small ? (
                                    <button key={b.id} onClick={() => go(b.id, "/dashboard/marca")}
                                        className="h-14 px-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-edge-strong)] text-left cursor-pointer hover:border-fg hover:bg-[var(--color-surface-1)] transition-colors">
                                        <span className="flex-1 min-w-0 text-[14px] text-fg truncate">{b.name}</span>
                                        <span className="text-[12px] text-fg-faint shrink-0">Cargar ficha</span>
                                    </button>
                                ) : (
                                    <article key={b.id} className="group flex flex-col rounded-[var(--radius-md)] border border-edge bg-[var(--color-surface-1)] overflow-hidden transition-[border-color,box-shadow] hover:border-[var(--color-edge-strong)] hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]">
                                        <button onClick={() => go(b.id, "/dashboard/marca")} className="block text-left cursor-pointer" aria-label={`Abrir ${b.name}`}>
                                            <Mosaic b={b} />
                                        </button>
                                        <div className="px-4 pt-3.5 pb-3 flex flex-col gap-1">
                                            <div className="flex items-center gap-2.5">
                                                {b.logo && <img src={backendUrl(b.logo)} alt="" className="w-5 h-5 object-contain rounded-[2px] bg-white p-px" />}
                                                <button onClick={() => go(b.id, "/dashboard/marca")} className="text-[16px] text-fg truncate cursor-pointer hover:underline underline-offset-2">{b.name}</button>
                                                {(b.changes > 0 || b.newMaterial > 0) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] shrink-0" title="Le toca a Coevo" />}
                                            </div>
                                            <p className="text-[12.5px] text-fg-muted truncate">{brandLine(b)}</p>
                                        </div>
                                        <div className="mt-auto flex border-t border-edge text-[12px]">
                                            {[["Marca", "/dashboard/marca"], ["Entregas", "/dashboard/entregas"], ...(g.id === "plan" ? [["Calendario", "/dashboard/entregas/plan"]] : [])].map(([label, href]) => (
                                                <button key={href} onClick={() => go(b.id, href)}
                                                    className="flex-1 h-9 text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer border-l border-edge first:border-l-0 transition-colors">
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
