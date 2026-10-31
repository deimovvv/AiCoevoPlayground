import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { getBrandLearning, updateBrand } from "../../lib/api";
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
                            <ul className="mt-2 flex flex-col gap-1">
                                {c.examples.slice(0, 3).map((e, i) => (
                                    <li key={i} className="text-[11px] text-fg-muted leading-snug">«{e.text}» <span className="text-fg-faint">— {e.delivery}{e.byClient ? " · cliente" : ""}</span></li>
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

            <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Por ángulo</p>
                <table className="mt-3 w-full text-[12px]">
                    <thead>
                        <tr className="text-left text-[10px] font-mono uppercase tracking-[0.06em] text-fg-faint">
                            <th className="py-1.5 font-normal">Ángulo</th><th className="font-normal text-right">Piezas</th><th className="font-normal text-right">A la primera</th>
                            <th className="font-normal text-right">Vueltas</th><th className="font-normal text-right" title="Alcance, guardados y compartidos a 7 días: llegan con Postiz">Alcance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.angles.map((a) => (
                            <tr key={a.angle ?? "-"} className="border-t border-[var(--color-edge-subtle)]">
                                <td className="py-1.5 text-fg">{a.angle ?? <span className="text-fg-faint">sin ángulo</span>}</td>
                                <td className="text-right tabular-nums">{a.pieces}</td>
                                <td className="text-right tabular-nums">{a.approved ? `${a.firstTime} de ${a.approved}` : "—"}</td>
                                <td className="text-right tabular-nums">{(a.rounds / Math.max(1, a.pieces)).toFixed(1)}</td>
                                <td className="text-right text-fg-faint">—</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-2 text-[11px] text-fg-faint">Alcance, guardados y compartidos a 7 días llegan cuando Postiz esté conectado.</p>
            </section>
        </div>
    );
}
