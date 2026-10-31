import { Link, useLocation } from "react-router";
import { useBrand } from "../../lib/BrandContext";
import { updateBrand } from "../../lib/api";
import type { WorkType } from "../../lib/api";

/**
 * Las pestañas de Entregas para el equipo (2026-10-31): Piezas · Calendario · Aprendizaje.
 * El calendario aparece sólo si la marca compró el **plan mensual** (venture Coevo Studio); una marca
 * por **proyectos** (encargos de la casa creativa, ej. Koxis) ve sus piezas y lo que se aprende.
 * A la derecha, el tipo de trabajo de la marca, para cambiarlo sin ir a otra pantalla.
 */
export function EntregasTabs() {
    const { activeBrand, refreshBrands } = useBrand();
    const { pathname, search } = useLocation();
    if (!activeBrand) return null;
    const work: WorkType = activeBrand.workType ?? "proyectos";
    const tab = pathname.endsWith("/plan") ? (new URLSearchParams(search).get("v") === "aprendizaje" ? "aprendizaje" : "calendario") : "piezas";
    const tabs = [
        { id: "piezas", label: "Piezas", to: "/dashboard/entregas" },
        ...(work === "plan" ? [{ id: "calendario", label: "Calendario", to: "/dashboard/entregas/plan" }] : []),
        { id: "aprendizaje", label: "Aprendizaje", to: "/dashboard/entregas/plan?v=aprendizaje" },
    ];
    const setWork = async (w: WorkType) => { await updateBrand(activeBrand.id, { workType: w }); await refreshBrands(); };

    return (
        <nav className="h-12 shrink-0 px-4 md:px-6 flex items-center gap-1 border-b border-edge" aria-label="Entregas">
            {tabs.map((t) => (
                <Link key={t.id} to={t.to}
                    className={`relative h-12 px-3 flex items-center text-[13px] no-underline transition-colors ${tab === t.id ? "text-fg" : "text-fg-muted hover:text-fg"}`}>
                    {t.label}
                    {tab === t.id && <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-fg" />}
                </Link>
            ))}
            <span className="flex-1" />
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint mr-2">Trabajo</span>
            <div className="flex gap-0.5 p-0.5 rounded-[6px] bg-[var(--color-surface-2)] text-[12px]" role="radiogroup" aria-label="Tipo de trabajo">
                {([["proyectos", "Proyectos"], ["plan", "Plan mensual"]] as [WorkType, string][]).map(([w, l]) => (
                    <button key={w} role="radio" aria-checked={work === w} onClick={() => work !== w && setWork(w)}
                        title={w === "plan" ? "Coevo Studio: sistema mensual con calendario y publicación" : "Encargos de piezas y campañas, sin calendario"}
                        className={`h-7 px-3 rounded-[5px] cursor-pointer transition-colors ${work === w ? "bg-[var(--color-surface-1)] text-fg shadow-[var(--shadow-card)]" : "text-fg-muted hover:text-fg"}`}>{l}</button>
                ))}
            </div>
        </nav>
    );
}
