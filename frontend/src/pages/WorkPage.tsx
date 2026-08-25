/**
 * Trabajo — la pantalla de operación de Coevo World.
 * ───────────────────────────────────────────────────
 * Es la biblioteca de generaciones reorganizada por ESTADO DE TRABAJO en vez de por
 * fecha, con el costo real de cada pieza en la fila y el gasto del mes en el rail.
 *
 * La diferencia con ContentPage: aquélla es un archivo (qué hicimos), ésta es un
 * tablero (qué falta hacer). Los dos primeros filtros responden "¿qué necesita algo
 * de mí?" — ver docs/competitive-research.md § Superside.
 *
 * NO vive adentro de ToolRunPage a propósito: esta capa CONSUME las tools, nunca al revés.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, Search, Plus, AlertCircle } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { fetchGenerations, updateGeneration, WORK_STATUS_LABEL, WORK_STATUS_NEEDS_ACTION } from "../lib/api";
import type { Generation, WorkStatus } from "../lib/api";
import { formatUsd } from "../lib/pricing";
import { PRICE_NOTE } from "../lib/costLedger";
import { cn } from "../lib/utils";

/** Orden de los grupos en la lista — lo que exige acción primero. */
const GROUPS: Array<{ key: string; label: string; statuses: WorkStatus[] }> = [
    { key: "action", label: "Requiere acción", statuses: ["review", "changes"] },
    { key: "open", label: "En curso", statuses: ["in_progress", "draft"] },
    { key: "waiting", label: "Esperando al cliente", statuses: ["sent"] },
    { key: "done", label: "Aprobados", statuses: ["approved"] },
];

const PILL_CLS: Record<WorkStatus, string> = {
    review: "bg-[rgba(228,171,27,.14)] text-[var(--color-warning)]",
    changes: "bg-[rgba(233,101,101,.14)] text-[var(--color-error)]",
    in_progress: "bg-white/[.06] text-fg-secondary",
    draft: "bg-white/[.04] text-fg-faint",
    sent: "bg-white/[.06] text-fg-secondary",
    approved: "bg-[rgba(61,191,138,.13)] text-[var(--color-success)]",
};

/** Las corridas viejas no tienen workStatus — se infiere del status de pipeline. */
function statusOf(g: Generation): WorkStatus {
    if (g.workStatus) return g.workStatus;
    return g.status === "completed" ? "review" : "in_progress";
}

function daysAgo(iso?: string): string {
    if (!iso) return "";
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return "hoy";
    if (d === 1) return "ayer";
    return `hace ${d} días`;
}

export function WorkPage() {
    const { activeBrand, brands } = useBrand();
    const [gens, setGens] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [allBrands, setAllBrands] = useState(false);
    const [onlyAction, setOnlyAction] = useState(false);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetchGenerations(allBrands ? undefined : activeBrand?.id)
            .then(setGens)
            .catch(() => setGens([]))
            .finally(() => setLoading(false));
    }, [activeBrand?.id, allBrands]);

    const brandName = useMemo(() => {
        const m: Record<string, string> = {};
        for (const b of brands) m[b.id] = b.name;
        return m;
    }, [brands]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return gens.filter((g) => {
            if (onlyAction && !WORK_STATUS_NEEDS_ACTION.includes(statusOf(g))) return false;
            if (q && !`${g.title} ${g.toolId}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [gens, onlyAction, search]);

    const grouped = useMemo(
        () => GROUPS.map((grp) => ({
            ...grp,
            items: visible.filter((g) => grp.statuses.includes(statusOf(g))),
        })).filter((grp) => grp.items.length > 0),
        [visible],
    );

    const actionCount = useMemo(
        () => gens.filter((g) => WORK_STATUS_NEEDS_ACTION.includes(statusOf(g))).length,
        [gens],
    );

    /** Gasto del período por marca, contando SOLO lo que ya tiene costo registrado. */
    const spend = useMemo(() => {
        const byBrand: Record<string, number> = {};
        let total = 0, pieces = 0, unpriced = 0;
        for (const g of gens) {
            const usd = g.cost?.usd;
            if (typeof usd !== "number") { unpriced++; continue; }
            const key = g.brandId || "—";
            byBrand[key] = (byBrand[key] || 0) + usd;
            total += usd;
            pieces++;
        }
        const rows = Object.entries(byBrand).sort((a, b) => b[1] - a[1]);
        return { rows, total, pieces, unpriced, avg: pieces > 0 ? total / pieces : 0 };
    }, [gens]);

    const setStatus = async (g: Generation, workStatus: WorkStatus) => {
        setSaving(g.id);
        // Optimista: la lista se reordena sola al cambiar de grupo.
        setGens((prev) => prev.map((x) => (x.id === g.id ? { ...x, workStatus } : x)));
        try {
            await updateGeneration(g.id, {
                brandId: g.brandId, toolId: g.toolId, title: g.title,
                type: g.type, status: g.status, workStatus,
            });
        } catch {
            setGens((prev) => prev.map((x) => (x.id === g.id ? { ...x, workStatus: g.workStatus } : x)));
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="px-6 py-5 max-w-[1400px]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <h1 className="text-[21px] font-semibold tracking-[-.01em]">Trabajo</h1>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-2 h-9 px-3 rounded-[var(--radius-sm)] border border-edge">
                        <Search size={13} className="text-fg-faint" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar"
                            className="bg-transparent text-[12px] outline-none w-32 placeholder:text-fg-faint"
                        />
                    </div>
                    <Link
                        to="/dashboard/generate"
                        className="flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] bg-[var(--color-warm)] text-white text-[12px] font-semibold"
                    >
                        <Plus size={13} /> Nueva pieza
                    </Link>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                <button
                    onClick={() => setOnlyAction((v) => !v)}
                    className={cn(
                        "h-7 px-3 rounded-full text-[11.5px] border transition-colors cursor-pointer",
                        onlyAction
                            ? "border-[rgba(228,171,27,.32)] bg-[rgba(228,171,27,.09)] text-[var(--color-warning)]"
                            : "border-edge-subtle bg-surface-1 text-fg-muted hover:text-fg-secondary",
                    )}
                >
                    Requiere acción · {actionCount}
                </button>
                <button
                    onClick={() => setAllBrands((v) => !v)}
                    className={cn(
                        "h-7 px-3 rounded-full text-[11.5px] border transition-colors cursor-pointer",
                        allBrands
                            ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                            : "border-edge-subtle bg-surface-1 text-fg-muted hover:text-fg-secondary",
                    )}
                >
                    {allBrands ? "Todas las marcas" : activeBrand?.name || "Marca activa"}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_270px] gap-6">
                {/* Lista */}
                <div>
                    {loading ? (
                        <div className="flex items-center gap-2 text-fg-muted text-[13px] py-10">
                            <Loader2 size={14} className="animate-spin" /> Cargando…
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="border border-edge-subtle rounded-[var(--radius-md)] p-10 text-center text-fg-muted text-[13px]">
                            No hay piezas que mostrar con estos filtros.
                        </div>
                    ) : (
                        grouped.map((grp) => (
                            <section key={grp.key} className="mb-7">
                                <p className="text-[10.5px] font-mono uppercase tracking-[.12em] text-fg-faint pb-2">
                                    {grp.label} · {grp.items.length}
                                </p>
                                {grp.items.map((g) => {
                                    const st = statusOf(g);
                                    return (
                                        <div
                                            key={g.id}
                                            className={cn(
                                                "flex items-center gap-4 px-3 py-3 border-b border-edge-subtle rounded-[var(--radius-sm)]",
                                                grp.key === "action" && "bg-[rgba(228,171,27,.05)]",
                                            )}
                                        >
                                            {g.thumbnailUrl && (
                                                <img
                                                    src={g.thumbnailUrl.startsWith("http") ? g.thumbnailUrl : `http://127.0.0.1:8000${g.thumbnailUrl}`}
                                                    alt=""
                                                    className="w-8 h-11 object-cover rounded-[3px] shrink-0 bg-surface-2"
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-medium truncate">{g.title}</p>
                                                <p className="text-[10.5px] font-mono text-fg-faint mt-0.5 truncate">
                                                    {allBrands && g.brandId ? `${brandName[g.brandId] || g.brandId} · ` : ""}
                                                    {g.toolId} · {daysAgo(g.createdAt)}
                                                </p>
                                            </div>

                                            {/* Costo real — vacío cuando la corrida es anterior al ledger */}
                                            <span
                                                className="text-[11.5px] font-mono tabular-nums text-fg-secondary w-16 text-right shrink-0"
                                                title={
                                                    g.cost
                                                        ? `${g.cost.images} img · ${g.cost.videoSeconds}s video${g.cost.verified ? "" : " · incluye precios estimados"}`
                                                        : "Sin costo registrado — corrida anterior al costing layer"
                                                }
                                            >
                                                {g.cost ? formatUsd(g.cost.usd) : "—"}
                                            </span>

                                            <select
                                                value={st}
                                                disabled={saving === g.id}
                                                onChange={(e) => setStatus(g, e.target.value as WorkStatus)}
                                                className={cn(
                                                    "text-[11px] font-medium px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer shrink-0",
                                                    PILL_CLS[st],
                                                )}
                                            >
                                                {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((s) => (
                                                    <option key={s} value={s} className="bg-surface-1 text-fg">
                                                        {WORK_STATUS_LABEL[s]}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </section>
                        ))
                    )}
                </div>

                {/* Rail de costo */}
                <aside className="lg:border-l lg:border-edge-subtle lg:pl-5">
                    <p className="text-[10px] font-mono uppercase tracking-[.13em] text-fg-faint mb-3">
                        Costo registrado
                    </p>
                    {spend.rows.length === 0 ? (
                        <p className="text-[12px] text-fg-muted leading-relaxed">
                            Todavía no hay costo registrado. Se llena solo con cada corrida nueva.
                        </p>
                    ) : (
                        <>
                            {spend.rows.map(([bid, usd]) => (
                                <div key={bid} className="flex items-center gap-2 py-2 border-b border-edge-subtle">
                                    <span className="text-[12px] text-fg-secondary truncate">{brandName[bid] || bid}</span>
                                    <span className="ml-auto text-[12px] font-mono tabular-nums">{formatUsd(usd)}</span>
                                </div>
                            ))}
                            <div className="mt-4 p-3.5 bg-surface-1 border border-edge-subtle rounded-[var(--radius-md)]">
                                <p className="text-[11px] text-fg-faint">Total</p>
                                <p className="text-[24px] font-mono tabular-nums leading-tight mt-0.5">
                                    {formatUsd(spend.total)}
                                </p>
                                <p className="text-[11px] text-fg-muted mt-2.5 pt-2.5 border-t border-edge-subtle">
                                    {spend.pieces} piezas · <b className="font-mono font-medium text-fg">{formatUsd(spend.avg)}</b> c/u
                                </p>
                            </div>
                        </>
                    )}

                    {spend.unpriced > 0 && (
                        <div className="mt-3 flex gap-2 text-[11px] text-fg-muted leading-relaxed">
                            <AlertCircle size={12} className="shrink-0 mt-0.5 text-fg-faint" />
                            <span>
                                {spend.unpriced} piezas sin costo — son anteriores al registro y no se pueden
                                reconstruir con exactitud.
                            </span>
                        </div>
                    )}

                    <p className="mt-4 text-[10.5px] font-mono text-fg-faint leading-relaxed">{PRICE_NOTE}</p>
                </aside>
            </div>
        </div>
    );
}
