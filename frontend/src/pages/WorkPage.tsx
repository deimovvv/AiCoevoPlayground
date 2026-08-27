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
import { Loader2, Search, Plus, AlertCircle, Folder, ChevronRight, ChevronDown, Sparkles, MessageSquare } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { fetchGenerations, updateGeneration, listCampaigns, listBrandNotes, resolveBrandNote, WORK_STATUS_LABEL, WORK_STATUS_NEEDS_ACTION } from "../lib/api";
import type { Generation, WorkStatus, Campaign, PortalNote } from "../lib/api";
import { formatUsd } from "../lib/pricing";
import { PRICE_NOTE } from "../lib/costLedger";
import { cn } from "../lib/utils";

// Manual Lab es el sandbox: 2.825 de las 3.211 generaciones históricas salieron de ahí.
// Son pruebas, no entregables — un tablero de trabajo con eso adentro es ruido.
const SANDBOX_TOOLS = ["manual_lab"];

// El Historial puede tener cientos de corridas viejas. Se muestran las últimas y se
// dice cuántas quedaron afuera — nunca truncar en silencio.
const ARCHIVE_LIMIT = 25;

/** Orden de los grupos en la lista — lo que exige acción primero. */
const GROUPS: Array<{ key: string; label: string; statuses: WorkStatus[] }> = [
    { key: "action", label: "Requiere acción", statuses: ["review", "changes"] },
    { key: "open", label: "En curso", statuses: ["in_progress", "draft"] },
    { key: "waiting", label: "Esperando al cliente", statuses: ["sent"] },
    { key: "done", label: "Aprobados", statuses: ["approved"] },
    { key: "archive", label: "Historial", statuses: ["archived"] },
];

const PILL_CLS: Record<WorkStatus, string> = {
    review: "bg-[rgba(228,171,27,.14)] text-[var(--color-warning)]",
    changes: "bg-[rgba(233,101,101,.14)] text-[var(--color-error)]",
    in_progress: "bg-white/[.06] text-fg-secondary",
    draft: "bg-white/[.04] text-fg-faint",
    sent: "bg-white/[.06] text-fg-secondary",
    approved: "bg-[rgba(61,191,138,.13)] text-[var(--color-success)]",
    archived: "bg-white/[.04] text-fg-faint",
};

/**
 * Las corridas anteriores al costing layer no tienen `workStatus`. NO se infiere "para
 * revisar" — eso mandaba 3.000 piezas viejas a exigir acción y volvía inútil el tablero.
 * Van a Historial: no sabemos en qué quedaron, y fingir que sí sería peor.
 */
function statusOf(g: Generation): WorkStatus {
    if (g.workStatus) return g.workStatus;
    return g.status === "completed" ? "archived" : "in_progress";
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
    const [showSandbox, setShowSandbox] = useState(false);
    // Los thumbs viejos apuntan a fal.media, que expira. Se recuerda cuál falló para
    // no dejar el recuadro roto en cada re-render.
    const [brokenThumbs, setBrokenThumbs] = useState<Record<string, true>>({});
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [openCampaigns, setOpenCampaigns] = useState<Record<string, true>>({});
    // Notas del cliente: input para el próximo briefing, NO trabajo. No entran a la lista
    // de piezas a propósito — meterlas ahí sería tratar un comentario como una orden.
    const [notes, setNotes] = useState<PortalNote[]>([]);

    useEffect(() => {
        setLoading(true);
        fetchGenerations(allBrands ? undefined : activeBrand?.id)
            .then(setGens)
            .catch(() => setGens([]))
            .finally(() => setLoading(false));
    }, [activeBrand?.id, allBrands]);

    // Las campañas son los PEDIDOS: contenedores con piezas adentro. Antes vivían en su
    // propia pantalla y Trabajo mostraba solo piezas sueltas — dos listas para la misma
    // pregunta. Acá van juntas, como en el mockup de Coevo World.
    useEffect(() => {
        if (allBrands || !activeBrand) { setCampaigns([]); return; }
        listCampaigns(activeBrand.id).then(setCampaigns).catch(() => setCampaigns([]));
        listBrandNotes(activeBrand.id)
            .then((ns) => setNotes(ns.filter((n) => !n.resolvedAt)))
            .catch(() => setNotes([]));
    }, [activeBrand?.id, allBrands]);

    const resolveNote = async (id: string) => {
        if (!activeBrand) return;
        setNotes((prev) => prev.filter((n) => n.id !== id));
        try { await resolveBrandNote(activeBrand.id, id); } catch { /* vuelve al recargar */ }
    };

    /** El estado de trabajo de una campaña sale de sus piezas; si no tiene, de su propio estado. */
    const campaignStatus = (c: Campaign): WorkStatus => {
        const linked = gens.filter((g) => (c.generationIds || []).includes(g.id));
        if (linked.length > 0) {
            const sts = linked.map(statusOf);
            if (sts.some((x) => WORK_STATUS_NEEDS_ACTION.includes(x))) return "review";
            if (sts.every((x) => x === "approved")) return "approved";
            if (sts.some((x) => x === "in_progress" || x === "draft")) return "in_progress";
            return sts[0];
        }
        // Un pedido que MANDÓ EL CLIENTE y todavía nadie tocó exige acción nuestra —
        // no es un borrador que dejamos a medias. Es la diferencia entre "me olvidé"
        // y "alguien está esperando".
        if (c.source === "portal" && c.status === "draft") return "review";
        return c.status === "approved" ? "approved"
            : c.status === "review" ? "review"
            : c.status === "generating" ? "in_progress"
            : "draft";
    };

    const brandName = useMemo(() => {
        const m: Record<string, string> = {};
        for (const b of brands) m[b.id] = b.name;
        return m;
    }, [brands]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return gens.filter((g) => {
            if (!showSandbox && SANDBOX_TOOLS.includes(g.toolId)) return false;
            if (onlyAction && !WORK_STATUS_NEEDS_ACTION.includes(statusOf(g))) return false;
            if (q && !`${g.title} ${g.toolId}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [gens, onlyAction, search, showSandbox]);

    const sandboxCount = useMemo(
        () => gens.filter((g) => SANDBOX_TOOLS.includes(g.toolId)).length,
        [gens],
    );

    /** Ids de generaciones que ya cuelgan de una campaña — no se repiten como sueltas. */
    const inCampaign = useMemo(() => {
        const set = new Set<string>();
        for (const c of campaigns) for (const id of c.generationIds || []) set.add(id);
        return set;
    }, [campaigns]);

    /**
     * Una fila puede ser un PEDIDO (campaña, con piezas adentro) o una PIEZA suelta.
     * Ambas se agrupan por el mismo estado de trabajo.
     */
    type Row =
        | { kind: "campaign"; id: string; status: WorkStatus; campaign: Campaign; children: Generation[] }
        | { kind: "piece"; id: string; status: WorkStatus; gen: Generation };

    const rows = useMemo<Row[]>(() => {
        const q = search.trim().toLowerCase();
        const campaignRows: Row[] = campaigns
            .filter((c) => !q || c.name.toLowerCase().includes(q))
            .map((c) => ({
                kind: "campaign" as const,
                id: c.id,
                status: campaignStatus(c),
                campaign: c,
                children: gens.filter((g) => (c.generationIds || []).includes(g.id)),
            }));
        const pieceRows: Row[] = visible
            .filter((g) => !inCampaign.has(g.id))
            .map((g) => ({ kind: "piece" as const, id: g.id, status: statusOf(g), gen: g }));
        return [...campaignRows, ...pieceRows];
    }, [campaigns, visible, inCampaign, gens, search]);

    const grouped = useMemo(
        () => GROUPS.map((grp) => ({
            ...grp,
            items: rows.filter((r) => grp.statuses.includes(r.status)),
        })).map((grp) => grp.key === "archive" && grp.items.length > ARCHIVE_LIMIT
            ? { ...grp, hidden: grp.items.length - ARCHIVE_LIMIT, items: grp.items.slice(0, ARCHIVE_LIMIT) }
            : { ...grp, hidden: 0 },
        ).filter((grp) => grp.items.length > 0),
        [rows],
    );

    const actionCount = useMemo(
        () => gens.filter((g) =>
            (showSandbox || !SANDBOX_TOOLS.includes(g.toolId)) &&
            WORK_STATUS_NEEDS_ACTION.includes(statusOf(g))
        ).length,
        [gens, showSandbox],
    );

    /** Gasto del período por marca, contando SOLO lo que ya tiene costo registrado. */
    const spend = useMemo(() => {
        const byBrand: Record<string, number> = {};
        let total = 0, pieces = 0, unpriced = 0;
        for (const g of gens) {
            if (!showSandbox && SANDBOX_TOOLS.includes(g.toolId)) continue;
            const usd = g.cost?.usd;
            if (typeof usd !== "number") { unpriced++; continue; }
            const key = g.brandId || "—";
            byBrand[key] = (byBrand[key] || 0) + usd;
            total += usd;
            pieces++;
        }
        // Las campañas llevan su costo aparte (sus piezas no son generaciones).
        for (const c of campaigns) {
            const usd = c.cost?.usd;
            if (typeof usd !== "number") continue;
            byBrand[c.brandId] = (byBrand[c.brandId] || 0) + usd;
            total += usd;
            pieces += (c.cost?.images || 0) + (c.cost?.videoClips || 0);
        }
        const rows = Object.entries(byBrand).sort((a, b) => b[1] - a[1]);
        return { rows, total, pieces, unpriced, avg: pieces > 0 ? total / pieces : 0 };
    }, [gens, showSandbox, campaigns]);

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
                        to="/dashboard/campaigns/new"
                        className="flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-secondary hover:text-fg"
                    >
                        <Folder size={13} /> Nuevo pedido
                    </Link>
                    <Link
                        to="/dashboard/generate"
                        className="flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[12px] font-semibold"
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
                {sandboxCount > 0 && (
                    <button
                        onClick={() => setShowSandbox((v) => !v)}
                        title="Manual Lab es el sandbox — pruebas, no entregables"
                        className={cn(
                            "h-7 px-3 rounded-full text-[11.5px] border transition-colors cursor-pointer",
                            showSandbox
                                ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                                : "border-edge-subtle bg-surface-1 text-fg-muted hover:text-fg-secondary",
                        )}
                    >
                        {showSandbox ? "Ocultar Lab" : `Incluir Lab · ${sandboxCount}`}
                    </button>
                )}
            </div>

            {notes.length > 0 && (
                <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-action)] bg-[var(--color-action-muted)] px-5 py-4">
                    <h2 className="text-[13.5px] font-semibold">Dijo el cliente</h2>
                    <p className="text-[11.5px] text-fg-muted mb-3">
                        Input para el próximo briefing — no es trabajo hasta que lo definan juntos
                    </p>
                    {notes.map((n) => (
                        <div key={n.id} className="flex items-start gap-3 py-2.5 border-b border-edge-subtle last:border-0">
                            <MessageSquare size={13} className="shrink-0 mt-0.5 text-fg-muted" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-fg leading-relaxed">{n.text}</p>
                                <p className="text-[10.5px] font-mono text-fg-faint mt-1">
                                    {n.by || "sin nombre"} · {daysAgo(n.createdAt)}
                                </p>
                            </div>
                            <button
                                onClick={() => resolveNote(n.id)}
                                title="Marcar como conversada"
                                className="h-7 px-3 rounded-[var(--radius-sm)] border border-edge text-[11.5px] text-fg-muted hover:text-fg shrink-0 cursor-pointer"
                            >
                                Conversada
                            </button>
                        </div>
                    ))}
                </div>
            )}

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
                                {grp.items.map((row) => {
                                    if (row.kind === "campaign") {
                                        const c = row.campaign;
                                        const open = !!openCampaigns[c.id];
                                        return (
                                            <div key={c.id} className="border-b border-edge-subtle">
                                                <div className={cn(
                                                    "flex items-center gap-3 px-3 py-3 rounded-[var(--radius-sm)]",
                                                    grp.key === "action" && "bg-[rgba(228,171,27,.05)]",
                                                )}>
                                                    <button
                                                        onClick={() => setOpenCampaigns((p) => {
                                                            const n = { ...p };
                                                            if (n[c.id]) delete n[c.id]; else n[c.id] = true;
                                                            return n;
                                                        })}
                                                        disabled={row.children.length === 0}
                                                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer disabled:cursor-default"
                                                    >
                                                        {row.children.length > 0
                                                            ? (open ? <ChevronDown size={13} className="text-fg-faint shrink-0" /> : <ChevronRight size={13} className="text-fg-faint shrink-0" />)
                                                            : <span className="w-[13px] shrink-0" />}
                                                        <Folder size={14} className="text-fg-muted shrink-0" />
                                                        <span className="min-w-0">
                                                            <span className="text-[13px] font-medium truncate block">
                                                                {c.name || "Campaña sin nombre"}
                                                                <span className="text-fg-faint font-normal ml-1.5">{c.pieces?.length || row.children.length || 0}</span>
                                                            </span>
                                                            <span className="text-[10.5px] font-mono text-fg-faint block mt-0.5">
                                                                {c.source === "portal"
                                                                    ? `lo pidió el cliente${c.requestedBy ? ` (${c.requestedBy})` : ""}`
                                                                    : "pedido"} · {daysAgo(c.createdAt)}
                                                            </span>
                                                        </span>
                                                    </button>
                                                    <span className="text-[11.5px] font-mono tabular-nums text-fg-secondary w-16 text-right shrink-0">
                                                        {c.cost ? formatUsd(c.cost.usd) : "—"}
                                                    </span>
                                                    <Link
                                                        to={`/dashboard/campaigns/${c.id}`}
                                                        title="Abrir el pedido y generar sus piezas"
                                                        className="h-7 px-3 rounded-[var(--radius-sm)] border border-edge text-[11.5px] text-fg-secondary hover:text-fg hover:border-edge-strong flex items-center gap-1.5 shrink-0"
                                                    >
                                                        <Sparkles size={11} /> Generar
                                                    </Link>
                                                    <span className={cn("text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0", PILL_CLS[row.status])}>
                                                        {WORK_STATUS_LABEL[row.status]}
                                                    </span>
                                                </div>
                                                {open && row.children.map((g) => (
                                                    <div key={g.id} className="flex items-center gap-3 pl-12 pr-3 py-2 border-t border-edge-subtle">
                                                        <span className="text-[12.5px] text-fg-secondary truncate flex-1">{g.title}</span>
                                                        <span className="text-[11px] font-mono tabular-nums text-fg-faint w-16 text-right">
                                                            {g.cost ? formatUsd(g.cost.usd) : "—"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    const g = row.gen;
                                    const st = row.status;
                                    return (
                                        <div
                                            key={g.id}
                                            className={cn(
                                                "flex items-center gap-4 px-3 py-3 border-b border-edge-subtle rounded-[var(--radius-sm)]",
                                                grp.key === "action" && "bg-[rgba(228,171,27,.05)]",
                                            )}
                                        >
                                            {g.thumbnailUrl && !brokenThumbs[g.id] ? (
                                                <img
                                                    src={g.thumbnailUrl.startsWith("http") ? g.thumbnailUrl : `http://127.0.0.1:8000${g.thumbnailUrl}`}
                                                    alt=""
                                                    onError={() => setBrokenThumbs((p) => ({ ...p, [g.id]: true }))}
                                                    className="w-8 h-11 object-cover rounded-[3px] shrink-0 bg-surface-2"
                                                />
                                            ) : (
                                                <span
                                                    className="w-8 h-11 rounded-[3px] shrink-0 border border-edge-subtle"
                                                    title={g.thumbnailUrl ? "La miniatura expiró (fal.media)" : "Sin miniatura"}
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-medium truncate">{g.title}</p>
                                                <p className="text-[10.5px] font-mono text-fg-faint mt-0.5 truncate">
                                                    {allBrands && g.brandId ? `${brandName[g.brandId] || g.brandId} · ` : ""}
                                                    {g.toolId} · {daysAgo(g.createdAt)}
                                                </p>
                                            </div>

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
                                                {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((sv) => (
                                                    <option key={sv} value={sv} className="bg-surface-1 text-fg">
                                                        {WORK_STATUS_LABEL[sv]}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                                {grp.hidden > 0 && (
                                    <p className="text-[11.5px] text-fg-faint pt-3">
                                        + {grp.hidden} corridas más en el historial —{" "}
                                        <Link to="/dashboard/content" className="underline hover:text-fg-secondary">
                                            verlas en Contenido
                                        </Link>
                                    </p>
                                )}
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
