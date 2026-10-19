import { useEffect, useState } from "react";
import { useBrand } from "../lib/BrandContext";
import { createUser, listUsers, updateUser, type Role, type StudioUser, type StudioUserIn } from "../lib/api";

/**
 * Accesos (studio-v2 §3, sólo admin): quién entra y qué ve.
 * Para que alguien pueda ENTRAR, su mail también tiene que estar en la policy de Cloudflare
 * Access. Esta pantalla decide QUÉ ve una vez adentro.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", equipo: "Equipo", cliente: "Cliente" };

const empty = (): StudioUserIn => ({ email: "", name: "", role: "cliente", brands: [] });

export function AccesosPage() {
    const { brands } = useBrand();
    const [users, setUsers] = useState<StudioUser[] | null>(null);
    const [form, setForm] = useState<StudioUserIn>(empty);
    const [editing, setEditing] = useState<string | null>(null);   // id del usuario que se edita
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { listUsers().then(setUsers).catch((e) => setError(e.message)); }, []);
    const nameOf = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

    const toggleBrand = (id: string) => setForm((f) => ({
        ...f, brands: f.brands.some((b) => b.id === id) ? f.brands.filter((b) => b.id !== id) : [...f.brands, { id, canApprove: true }],
    }));
    const toggleApprove = (id: string) => setForm((f) => ({
        ...f, brands: f.brands.map((b) => (b.id === id ? { ...b, canApprove: !b.canApprove } : b)),
    }));
    const save = async () => {
        setBusy(true); setError(null);
        try {
            const u = editing ? await updateUser(editing, form) : await createUser(form);
            setUsers((list) => {
                const rest = (list || []).filter((x) => x.id !== u.id);
                return [...rest, u].sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));
            });
            setForm(empty()); setEditing(null);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const edit = (u: StudioUser) => {
        setEditing(u.id);
        setForm({ email: u.email, name: u.name, role: u.role, brands: u.brands, disabled: u.disabled });
    };

    return (
        <div className="grid gap-12 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] pb-16">
            <section>
                <p className={`${mono} text-fg-faint`}>Accesos</p>
                <h1 className="mt-3 text-[40px] leading-none tracking-[-0.035em] text-fg">Quién entra a Studio</h1>
                <p className="mt-4 max-w-[560px] text-[13px] leading-relaxed text-fg-muted">
                    El equipo ve todas las marcas. Un cliente ve sólo las suyas: sus entregas y su marca, nada más.
                    Para que pueda entrar, sumá su mail también en Cloudflare (Access → Policies).
                </p>
                <div className="mt-8 border-t border-edge">
                    {users === null && <p className="py-5 text-[13px] text-fg-faint">Cargando…</p>}
                    {users?.map((u) => (
                        <button key={u.id} onClick={() => edit(u)}
                            className={`w-full grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1.2fr)] gap-4 items-baseline py-4 border-b border-edge text-left cursor-pointer hover:bg-[var(--color-surface-1)] px-2 ${u.disabled ? "opacity-45" : ""} ${editing === u.id ? "bg-[var(--color-surface-1)]" : ""}`}>
                            <span className="min-w-0">
                                <span className="block text-[14px] text-fg truncate">{u.name || u.email}</span>
                                {u.name && <span className="block text-[12px] text-fg-faint truncate">{u.email}</span>}
                            </span>
                            <span className={`${mono} ${u.role === "cliente" ? "text-fg" : "text-fg-faint"}`}>{ROLE_LABEL[u.role]}{u.disabled && " · baja"}</span>
                            <span className="text-[12px] text-fg-muted truncate">
                                {u.role === "cliente"
                                    ? u.brands.map((b) => `${nameOf(b.id)}${b.canApprove ? "" : " (sólo comenta)"}`).join(", ")
                                    : "Todas las marcas"}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <aside className="lg:pt-[92px] flex flex-col gap-4">
                <p className="text-[15px] text-fg">{editing ? "Editar acceso" : "Dar acceso"}</p>
                <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">Mail
                    <input type="email" value={form.email} disabled={!!editing} onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="nombre@marca.com"
                        className="h-9 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg outline-none focus:border-fg/40 disabled:opacity-60" />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">Nombre (opcional)
                    <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="h-9 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg outline-none focus:border-fg/40" />
                </label>
                <fieldset className="flex flex-col gap-1.5">
                    <legend className="text-[12px] text-fg-muted mb-1.5">Rol</legend>
                    <div className="flex gap-1 p-0.5 bg-[var(--color-surface-2)] rounded-[5px]">
                        {(["cliente", "equipo", "admin"] as Role[]).map((r) => (
                            <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                                className={`flex-1 h-8 rounded-[4px] text-[12px] cursor-pointer ${form.role === r ? "bg-[var(--color-surface-1)] text-fg" : "text-fg-muted"}`}>
                                {ROLE_LABEL[r]}
                            </button>
                        ))}
                    </div>
                </fieldset>
                {form.role === "cliente" && (
                    <fieldset className="flex flex-col">
                        <legend className="text-[12px] text-fg-muted mb-1.5">Marcas que ve</legend>
                        <div className="max-h-[260px] overflow-y-auto border border-edge rounded-[4px] bg-[var(--color-surface-1)]">
                            {brands.filter((b) => !b.isSandbox).map((b) => {
                                const sel = form.brands.find((x) => x.id === b.id);
                                return (
                                    <div key={b.id} className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-edge-subtle)] last:border-0">
                                        <label className="flex-1 flex items-center gap-2 text-[13px] text-fg cursor-pointer">
                                            <input type="checkbox" checked={!!sel} onChange={() => toggleBrand(b.id)} /> {b.name}
                                        </label>
                                        {sel && (
                                            <label className="flex items-center gap-1.5 text-[11px] text-fg-muted cursor-pointer">
                                                <input type="checkbox" checked={sel.canApprove} onChange={() => toggleApprove(b.id)} /> aprueba
                                            </label>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </fieldset>
                )}
                {editing && (
                    <label className="flex items-center gap-2 text-[12px] text-fg-muted cursor-pointer">
                        <input type="checkbox" checked={!!form.disabled} onChange={(e) => setForm({ ...form, disabled: e.target.checked })} /> Dar de baja (deja de entrar)
                    </label>
                )}
                {error && <p className="text-[12px] text-[var(--color-error)]">{error}</p>}
                <div className="flex gap-2">
                    <button onClick={save} disabled={busy || !form.email.trim()}
                        className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-40">
                        {editing ? "Guardar" : "Dar acceso"}
                    </button>
                    {editing && <button onClick={() => { setEditing(null); setForm(empty()); setError(null); }} className="h-9 px-3 text-[13px] text-fg-muted cursor-pointer">Cancelar</button>}
                </div>
            </aside>
        </div>
    );
}
