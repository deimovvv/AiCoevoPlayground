import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useMe } from "../lib/useMe";
import { useConfirm } from "../lib/useConfirm";
import { addBrandPerson, listBrandPeople, removeBrandPerson, type BrandPerson } from "../lib/api";

/**
 * Equipo de la marca (studio-v2 1.6). El contacto principal suma a su gente sin pedírselo a Coevo:
 * pone el mail, elige si aprueba o sólo comenta, y al otro le llega la invitación. Los demás ven la
 * lista. Al contacto principal lo da de alta Coevo (Accesos → «suma gente»).
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

export function ClientePersonasPage() {
    const { activeBrand } = useBrand();
    const me = useMe();
    const brandId = activeBrand?.id;
    // El equipo (vista previa) puede todo; un cliente, si es contacto principal de esta marca.
    const mayInvite = !me.brands || me.brands.some((b) => b.id === brandId && b.canInvite);
    const [people, setPeople] = useState<BrandPerson[] | null>(null);
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [approve, setApprove] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [dialog, ask] = useConfirm();

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        listBrandPeople(brandId).then((p) => alive && setPeople(p)).catch(() => alive && setPeople([]));
        return () => { alive = false; };
    }, [brandId]);

    const add = async () => {
        if (!brandId) return;
        setBusy(true); setErr(null); setDone(null);
        try {
            const p = await addBrandPerson(brandId, { email: email.trim(), name: name.trim() || undefined, canApprove: approve });
            setPeople((l) => [...(l || []), p]);
            setDone(`Listo: le mandamos la invitación a ${p.email}.`);
            setEmail(""); setName(""); setApprove(false);
        } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    };
    const remove = async (p: BrandPerson) => {
        if (!brandId) return;
        if (!(await ask({ title: `¿Sacar a ${p.name || p.email}?`, body: `Deja de ver ${activeBrand?.name} en Coevo Studio.`, confirm: "Sacar", danger: true }))) return;
        try {
            await removeBrandPerson(brandId, p.id);
            setPeople((l) => (l || []).filter((x) => x.id !== p.id));
        } catch (e) { setErr((e as Error).message); }
    };
    const main = people?.find((p) => p.canInvite && !p.isMe);

    return (
        <div className="h-full overflow-y-auto">
            {dialog}
            <div className="max-w-[620px] mx-auto px-5 py-10 md:py-16 flex flex-col">
                <p className={`${mono} text-fg-faint`}>Equipo · {activeBrand?.name}</p>
                <h1 className="mt-3 text-[30px] md:text-[36px] leading-[1.05] font-light tracking-[-0.035em] text-fg">Quién ve tu marca.</h1>
                <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">
                    {mayInvite ? "Sumá a tu equipo: le llega un mail y entra con ese mail, con Google o con un código."
                        : `Para sumar a alguien, pedíselo a ${main ? main.name || main.email : "tu contacto principal"}.`}
                </p>

                <section className="mt-10">
                    {people === null && <p className="py-4 border-t border-edge text-[13px] text-fg-faint">Cargando…</p>}
                    {people?.length === 0 && <p className="py-4 border-t border-edge text-[13px] text-fg-faint">Todavía no hay nadie.</p>}
                    {people?.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 py-3.5 border-t border-edge last:border-b">
                            <span className="flex-1 min-w-0">
                                <span className="block text-[14px] text-fg truncate">{p.name || p.email}{p.isMe && <span className="text-fg-faint"> · vos</span>}</span>
                                {p.name && <span className="block text-[12px] text-fg-faint truncate">{p.email}</span>}
                            </span>
                            <span className={`${mono} text-fg-faint shrink-0`}>{p.canInvite ? "Principal" : p.canApprove ? "Aprueba" : "Comenta"}</span>
                            {mayInvite && !p.isMe && !(p.canInvite && me.role === "cliente") ? (
                                <button onClick={() => remove(p)} aria-label={`Sacar a ${p.email}`}
                                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-fg-faint hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer"><X size={13} /></button>
                            ) : <span className="w-7 shrink-0" />}
                        </div>
                    ))}
                </section>

                {mayInvite && (
                    <section className="mt-12 flex flex-col">
                        <p className={`${mono} text-fg-faint pb-3`}>Sumar a alguien</p>
                        <label className="flex flex-col gap-1 py-3 border-t border-edge">
                            <span className={`${mono} text-fg-faint`}>Mail</span>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="nombre@tumarca.com"
                                onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) add(); }}
                                className="h-9 bg-transparent text-[15px] text-fg placeholder:text-fg-faint outline-none" />
                        </label>
                        <label className="flex flex-col gap-1 py-3 border-t border-edge">
                            <span className={`${mono} text-fg-faint`}>Nombre (opcional)</span>
                            <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
                                className="h-9 bg-transparent text-[15px] text-fg placeholder:text-fg-faint outline-none" />
                        </label>
                        <div className="flex gap-1 p-0.5 mt-3 bg-[var(--color-surface-2)] rounded-[5px]" role="radiogroup" aria-label="Qué puede hacer">
                            {[[false, "Comenta"], [true, "Comenta y aprueba"]].map(([v, label]) => (
                                <button key={String(v)} type="button" role="radio" aria-checked={approve === v} onClick={() => setApprove(v as boolean)}
                                    className={`flex-1 h-9 rounded-[4px] text-[13px] cursor-pointer ${approve === v ? "bg-[var(--color-surface-1)] text-fg" : "text-fg-muted"}`}>
                                    {label as string}
                                </button>
                            ))}
                        </div>
                        {err && <p className="mt-4 text-[13px] text-[var(--color-error)]">{err}</p>}
                        {done && <p className="mt-4 text-[13px] text-fg">{done}</p>}
                        <div className="mt-6">
                            <button onClick={add} disabled={busy || !email.trim()}
                                className="h-11 px-6 flex items-center gap-2 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[14px] cursor-pointer disabled:opacity-30">
                                Mandar invitación <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
