import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { backendUrl, getBrandLearning, updateBrand } from "../../lib/api";
import type { Brand, BrandLearning } from "../../lib/api";

const KIND: Record<string, string> = {
    texto: "Texto", color: "Color", encuadre: "Encuadre", tono: "Tono", dato: "Dato", imagen: "Imagen", otro: "Otro", sin_tipo: "Sin clasificar",
};

/**
 * Lo que aprende la marca (brand-integrations §4): las correcciones por tipo, lo que se repitió tres veces
 * (candidato a regla) y, por ángulo, qué salió a la primera. Las reglas aprobadas van a la ficha (`ver_marca`).
 * Las métricas de redes (alcance, guardados, compartidos a 7 días) llegan con Postiz.
 */
export function LearningView({ brand, ask, onBrandChanged }: {
    brand: Brand;
    ask: (a: { title: string; input?: string; placeholder?: string; multiline?: boolean; confirm?: string }) => Promise<string | boolean | null>;
    onBrandChanged: () => Promise<void>;
}) {
    const navigate = useNavigate();
    const [data, setData] = useState<BrandLearning | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { getBrandLearning(brand.id).then(setData).catch((e) => setError((e as Error).message)); }, [brand.id]);

    const rules = brand.learnedRules ?? [];
    const saveRules = async (next: typeof rules) => {
        try { await updateBrand(brand.id, { learnedRules: next }); await onBrandChanged(); } catch (e) { setError((e as Error).message); }
    };
    const makeRule = async (kind: string | null, example?: string) => {
        const t = await ask({ title: "Nueva regla de la marca", input: "La regla", multiline: true, confirm: "Guardar regla",
            placeholder: example ? `Ej. a partir de «${example.slice(0, 80)}»` : "Ej. Los títulos van en una sola línea." });
        if (typeof t === "string" && t.trim()) await saveRules([...rules, { text: t.trim(), kind }]);
    };
    const total = data?.kinds.reduce((n, k) => n + k.count, 0) ?? 0;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 grid gap-8 md:grid-cols-2 content-start">
            {error && <p className="md:col-span-2 text-[12px] text-[var(--color-error)]">{error}</p>}

            <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Qué se corrige · {total}</p>
                {data && total === 0 && <p className="mt-2 text-[12px] text-fg-muted">Todavía no hay comentarios en las entregas de esta marca.</p>}
                <ul className="mt-3 flex flex-col gap-2">
                    {data?.kinds.map((k) => (
                        <li key={k.kind} className="flex items-center gap-3 text-[12px]">
                            <span className="w-28 shrink-0 text-fg-muted">{KIND[k.kind] ?? k.kind}</span>
                            <span className="flex-1 h-[6px] rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                                <span className="block h-full bg-[var(--color-warm)]" style={{ width: `${(k.count / Math.max(1, total)) * 100}%` }} />
                            </span>
                            <span className="w-8 text-right tabular-nums text-fg-faint">{k.count}</span>
                        </li>
                    ))}
                </ul>
                {data && data.kinds.some((k) => k.kind === "sin_tipo") && (
                    <p className="mt-2 text-[11px] text-fg-faint">Las notas de voz llegan clasificadas; los escritos los clasifica Claude al leerlos.</p>
                )}
            </section>

            <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Se repitió tres veces · candidatos a regla</p>
                {data && data.candidates.length === 0 && <p className="mt-2 text-[12px] text-fg-muted">Nada se repitió tres veces todavía.</p>}
                <ul className="mt-3 flex flex-col gap-3">
                    {data?.candidates.map((c) => (
                        <li key={c.kind} className="p-3 rounded-[var(--radius-md)] border border-edge bg-surface-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-fg">{KIND[c.kind] ?? c.kind}</span>
                                <span className="text-[11px] text-fg-faint">· {c.count} veces</span>
                                <span className="flex-1" />
                                <button onClick={() => makeRule(c.kind, c.examples[0]?.text)} className="h-7 px-2.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[11px] cursor-pointer">Hacer regla</button>
                            </div>
                            {/* La lámina que se corrigió, con el punto marcado: la regla se entiende mirando. */}
                            <ul className="mt-3 grid grid-cols-3 gap-2">
                                {c.examples.slice(0, 3).map((e, i) => (
                                    <li key={i} className="min-w-0">
                                        {e.image && (
                                            <span className="relative block aspect-[4/5] rounded-[2px] overflow-hidden bg-[var(--color-surface-2)]">
                                                <img src={backendUrl(e.image)} alt="" className="w-full h-full object-cover" />
                                                {e.x != null && e.y != null && (
                                                    <span style={{ left: `${e.x * 100}%`, top: `${e.y * 100}%` }}
                                                        className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand)] ring-2 ring-white" />
                                                )}
                                            </span>
                                        )}
                                        <span className="mt-1 block text-[11px] text-fg-muted leading-snug line-clamp-3">«{e.text}»</span>
                                        <span className="block text-[10px] text-fg-faint truncate">{e.delivery}{e.byClient ? " · cliente" : ""}</span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <div className="flex items-center">
                    <p className="flex-1 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Reglas de la marca · {rules.length}</p>
                    <button onClick={() => makeRule(null)} className="text-[11px] text-fg-muted hover:text-fg cursor-pointer">+ Regla</button>
                </div>
                <p className="mt-1 text-[11px] text-fg-faint">Las lee Claude antes de producir (en su ficha).</p>
                {rules.length === 0 && <p className="mt-2 text-[12px] text-fg-muted">Sin reglas todavía.</p>}
                <ol className="mt-3 flex flex-col divide-y divide-[var(--color-edge-subtle)]">
                    {rules.map((r, i) => (
                        <li key={i} className="group py-2 flex gap-3 text-[12px]">
                            <span className="w-20 shrink-0 text-fg-faint">{r.kind ? KIND[r.kind] ?? r.kind : "—"}</span>
                            <span className="flex-1 text-fg">{r.text}</span>
                            <button onClick={() => saveRules(rules.filter((_, j) => j !== i))} aria-label="Borrar la regla"
                                className="opacity-0 group-hover:opacity-100 text-fg-faint hover:text-[var(--color-error)] cursor-pointer"><Trash2 size={11} /></button>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="md:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Por ángulo</p>
                {data && data.angles.length === 0 && <p className="mt-2 text-[12px] text-fg-muted">Todavía no hay piezas.</p>}
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data?.angles.map((a) => (
                        <li key={a.angle ?? "-"} className="rounded-[var(--radius-md)] border border-edge bg-surface-1 overflow-hidden">
                            {/* Las piezas del ángulo, como se ven: que no sea todo número. */}
                            <div className="grid grid-cols-3 gap-px bg-[var(--color-edge-subtle)]">
                                {Array.from({ length: 3 }, (_, i) => a.covers[i]).map((c, i) => c?.url ? (
                                    <button key={c.id} onClick={() => navigate(`/dashboard/entregas?id=${c.id}`)} title={c.title}
                                        className="aspect-[4/5] overflow-hidden bg-[var(--color-surface-2)] cursor-pointer">
                                        <img src={backendUrl(c.url)} alt={c.title} className="w-full h-full object-cover hover:scale-[1.02] transition-transform" />
                                    </button>
                                ) : <span key={i} className="aspect-[4/5] bg-[var(--color-surface-2)]" />)}
                            </div>
                            <div className="p-3">
                                <p className="text-[13px] text-fg">{a.angle ?? <span className="text-fg-faint">Sin ángulo</span>}</p>
                                <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                                    <div><dt className="text-fg-faint">Piezas</dt><dd className="tabular-nums text-fg">{a.pieces}</dd></div>
                                    <div><dt className="text-fg-faint">A la primera</dt><dd className="tabular-nums text-fg">{a.approved ? `${a.firstTime} de ${a.approved}` : "—"}</dd></div>
                                    <div><dt className="text-fg-faint">Vueltas</dt><dd className="tabular-nums text-fg">{(a.rounds / Math.max(1, a.pieces)).toFixed(1)}</dd></div>
                                    <div title="Alcance, guardados y compartidos a 7 días: llegan con Postiz"><dt className="text-fg-faint">Alcance</dt><dd className="text-fg-faint">—</dd></div>
                                </dl>
                            </div>
                        </li>
                    ))}
                </ul>
                <p className="mt-2 text-[11px] text-fg-faint">Alcance, guardados y compartidos a 7 días llegan cuando Postiz esté conectado.</p>
            </section>
        </div>
    );
}
