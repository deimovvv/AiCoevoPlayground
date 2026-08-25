/**
 * Brand Brain — lo que la marca sabe de sí misma.
 * ────────────────────────────────────────────────
 * Es el Brand Kit que ya existía, sacado de Ajustes y puesto en la navegación. El cambio
 * no es cosmético: nadie visita su configuración, y sí visita un destino.
 *
 * Tres bloques:
 *   1. Dirección de arte — lo que las tools deberían leer antes de generar
 *   2. Lo que devolvió el cliente — las revisiones que hoy nadie lee
 *   3. Lo que tiene cargado — assets, piezas y costo
 *
 * Nota de nombres: el campo se llama `designSystem` en el modelo, pero no tiene nada que
 * ver con un design system de diseño gráfico — son reglas de dirección de arte (casting,
 * luz, locaciones, movimiento). El rename a `artDirection` va junto con el loop de
 * feedback, que es lo que va a escribir en él. Ver docs/decisions-log.md 2026-08.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { MessageSquareWarning, ArrowUpRight, Loader2 } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { listReviews, fetchGenerations } from "../lib/api";
import type { ReviewData, Generation } from "../lib/api";
import { formatUsd } from "../lib/pricing";

/** Los campos de dirección de arte, en el orden en que importan al generar. */
const ART_FIELDS: Array<{ key: string; label: string }> = [
    { key: "casting", label: "Casting" },
    { key: "photoStyle", label: "Estilo de foto" },
    { key: "lighting", label: "Luz" },
    { key: "composition", label: "Composición" },
    { key: "colorTreatment", label: "Color" },
    { key: "preferred_locations", label: "Locaciones" },
    { key: "product_presentation", label: "Producto" },
    { key: "motion_rules", label: "Movimiento" },
    { key: "visualDos", label: "Siempre" },
    { key: "visualDonts", label: "Nunca" },
];

function asText(v: unknown): string {
    if (Array.isArray(v)) return v.filter(Boolean).join(" · ");
    return typeof v === "string" ? v.trim() : "";
}

export function BrandBrainPage() {
    const { activeBrand } = useBrand();
    const [reviews, setReviews] = useState<ReviewData[]>([]);
    const [gens, setGens] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeBrand) return;
        setLoading(true);
        Promise.all([listReviews(), fetchGenerations(activeBrand.id)])
            .then(([rs, gs]) => {
                setReviews(rs.filter((r) => r.brandId === activeBrand.id));
                setGens(gs);
            })
            .catch(() => { setReviews([]); setGens([]); })
            .finally(() => setLoading(false));
    }, [activeBrand?.id]);

    /** Las devoluciones que pidieron cambios, con su comentario — lo crudo del loop. */
    const changes = useMemo(() => {
        const out: Array<{ title: string; comment: string; at: string }> = [];
        for (const r of reviews) {
            for (const fb of Object.values(r.feedback || {})) {
                if (fb.status !== "change") continue;
                out.push({
                    title: r.title || "Sin título",
                    comment: (fb.comment || "").trim(),
                    at: fb.updatedAt,
                });
            }
        }
        return out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    }, [reviews]);

    const approvedCount = useMemo(
        () => reviews.reduce(
            (n, r) => n + Object.values(r.feedback || {}).filter((f) => f.status === "approved").length,
            0,
        ),
        [reviews],
    );

    const spend = useMemo(
        () => gens.reduce((acc, g) => {
            const usd = g.cost?.usd;
            return typeof usd === "number" ? { usd: acc.usd + usd, n: acc.n + 1 } : acc;
        }, { usd: 0, n: 0 }),
        [gens],
    );

    if (!activeBrand) {
        return (
            <div className="px-6 py-5">
                <p className="text-[13px] text-fg-muted">Elegí una marca en el switcher para ver su Brand Brain.</p>
            </div>
        );
    }

    const ds = (activeBrand.designSystem || {}) as Record<string, unknown>;
    const filled = ART_FIELDS.filter((f) => asText(ds[f.key]));

    const stats: Array<{ v: string | number; k: string }> = [
        { v: activeBrand.clothing?.length || 0, k: "prendas" },
        { v: activeBrand.products?.length || 0, k: "productos" },
        { v: activeBrand.avatars?.length || 0, k: "modelos" },
        { v: activeBrand.poses?.length || 0, k: "poses" },
        { v: gens.length, k: "piezas generadas" },
        { v: spend.n > 0 ? formatUsd(spend.usd) : "—", k: "costo registrado" },
    ];

    return (
        <div className="px-6 py-5 max-w-[1200px]">
            <div className="flex items-baseline gap-3 mb-1">
                <h1 className="text-[21px] font-semibold tracking-[-.01em]">Brand Brain</h1>
                <span className="text-[13px] text-fg-muted">{activeBrand.name}</span>
                <Link
                    to={`/dashboard/brands/${activeBrand.id}`}
                    className="ml-auto flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg"
                >
                    Editar el brand kit <ArrowUpRight size={12} />
                </Link>
            </div>
            <p className="text-[12.5px] text-fg-muted mb-6">
                Lo que la marca sabe de sí misma, y lo que aprendió trabajando.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Dirección de arte */}
                <section className="rounded-[var(--radius-md)] border border-edge-subtle bg-surface-1 px-5 py-4">
                    <h2 className="text-[13.5px] font-semibold">Dirección de arte</h2>
                    <p className="text-[11.5px] text-fg-faint mb-4">
                        Las reglas que las tools leen antes de generar
                    </p>

                    {filled.length === 0 ? (
                        <div className="text-[12.5px] text-fg-muted leading-relaxed">
                            Esta marca no tiene dirección de arte cargada — el contenido va a salir genérico.
                            Se extrae con IA desde{" "}
                            <Link to={`/dashboard/brands/${activeBrand.id}`} className="underline hover:text-fg">
                                el brand kit
                            </Link>.
                        </div>
                    ) : (
                        filled.map((f) => (
                            <div key={f.key} className="flex gap-3 py-2 border-b border-edge-subtle last:border-0">
                                <span className="w-[100px] shrink-0 text-[10.5px] font-mono uppercase tracking-[.06em] text-fg-faint pt-0.5">
                                    {f.label}
                                </span>
                                <span className="text-[12.5px] text-fg-secondary leading-relaxed">{asText(ds[f.key])}</span>
                            </div>
                        ))
                    )}

                    {filled.length > 0 && filled.length < ART_FIELDS.length && (
                        <p className="text-[11px] text-fg-faint mt-3 pt-3 border-t border-edge-subtle">
                            {ART_FIELDS.length - filled.length} campos vacíos:{" "}
                            {ART_FIELDS.filter((f) => !asText(ds[f.key])).map((f) => f.label).join(", ")}
                        </p>
                    )}
                </section>

                {/* Devoluciones */}
                <section className="rounded-[var(--radius-md)] border border-edge-subtle bg-surface-1 px-5 py-4">
                    <h2 className="text-[13.5px] font-semibold">Lo que devolvió el cliente</h2>
                    <p className="text-[11.5px] text-fg-faint mb-4">
                        {loading
                            ? "Cargando…"
                            : `${reviews.length} revisiones · ${approvedCount} aprobados · ${changes.length} con cambios`}
                    </p>

                    {loading ? (
                        <Loader2 size={14} className="animate-spin text-fg-muted" />
                    ) : changes.length === 0 ? (
                        <p className="text-[12.5px] text-fg-muted leading-relaxed">
                            Todavía no hay devoluciones con pedidos de cambio para esta marca.
                        </p>
                    ) : (
                        <>
                            {changes.slice(0, 6).map((c, i) => (
                                <div key={i} className="flex gap-3 py-2.5 border-b border-edge-subtle last:border-0">
                                    <MessageSquareWarning size={13} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
                                    <div className="min-w-0">
                                        <p className="text-[12.5px] text-fg leading-snug">
                                            {c.comment || <span className="text-fg-faint italic">sin comentario escrito</span>}
                                        </p>
                                        <p className="text-[10.5px] font-mono text-fg-faint mt-1 truncate">
                                            {c.title}
                                            {c.at ? ` · ${new Date(c.at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : ""}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {/* El paso que falta: leer esto y proponer una regla. Se dice
                                explícito en vez de mostrar un botón que todavía no hace nada. */}
                            <p className="text-[11.5px] text-fg-muted mt-4 pt-3 border-t border-edge-subtle leading-relaxed">
                                Estas devoluciones todavía no alimentan la dirección de arte. El paso que falta
                                es leerlas y proponer una regla que puedas aceptar.
                            </p>
                        </>
                    )}
                </section>

                {/* Assets */}
                <section className="lg:col-span-2 rounded-[var(--radius-md)] border border-edge-subtle bg-surface-1 px-5 py-4">
                    <h2 className="text-[13.5px] font-semibold">Lo que tiene cargado</h2>
                    <p className="text-[11.5px] text-fg-faint mb-4">Todo esto ya vive en el brand kit</p>
                    <div className="flex flex-wrap gap-x-10 gap-y-4">
                        {stats.map((s) => (
                            <div key={s.k}>
                                <p className="font-mono text-[20px] tabular-nums leading-none">{s.v}</p>
                                <p className="text-[11px] text-fg-faint mt-1">{s.k}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
