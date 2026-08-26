/**
 * Clientes — quién de la marca entra al portal, y con qué link.
 * ──────────────────────────────────────────────────────────────
 * Un token por PERSONA en vez de uno por marca. Es el escalón previo a tener cuentas de
 * verdad: cero infraestructura de auth, pero ya sabés que el pedido lo mandó Euge y no
 * "alguien de Taller Santa Clara", y podés cortarle el acceso a una persona sin romperle
 * el link al resto.
 *
 * Cuándo deja de alcanzar (y hay que pasar a Clerk): cuando el cliente suba sus propios
 * assets, cuando haya que cobrarle, o cuando distintas personas necesiten permisos
 * distintos. Ver docs/decisions-log.md 2026-08.
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Copy, Check, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { listPortalLinks, createPortalLink, revokePortalLink } from "../lib/api";
import type { PortalLink } from "../lib/api";

const portalUrl = (token: string) => `${window.location.origin}/portal/${token}`;

export function ClientsPage() {
    const { activeBrand } = useBrand();
    const [links, setLinks] = useState<PortalLink[]>([]);
    const [legacyToken, setLegacyToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

    const load = () => {
        if (!activeBrand) return;
        setLoading(true);
        listPortalLinks(activeBrand.id)
            .then((d) => { setLinks(d.links); setLegacyToken(d.legacyToken); })
            .catch(() => { setLinks([]); setLegacyToken(null); })
            .finally(() => setLoading(false));
    };

    useEffect(load, [activeBrand?.id]);

    const create = async () => {
        if (!activeBrand || !name.trim() || creating) return;
        setCreating(true); setError(null);
        try {
            const link = await createPortalLink(activeBrand.id, name.trim(), email.trim() || undefined);
            setLinks((prev) => [...prev, link]);
            setName(""); setEmail("");
            // Se copia solo: el link recién creado no sirve de nada hasta que lo mandás.
            try { await navigator.clipboard.writeText(portalUrl(link.token)); setCopied(link.token); } catch { /* clipboard bloqueado */ }
            setTimeout(() => setCopied(null), 2500);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo crear");
        } finally {
            setCreating(false);
        }
    };

    const copy = async (token: string) => {
        try { await navigator.clipboard.writeText(portalUrl(token)); setCopied(token); setTimeout(() => setCopied(null), 2500); } catch { /* no-op */ }
    };

    const revoke = async (token: string) => {
        if (!activeBrand) return;
        setLinks((prev) => prev.filter((l) => l.token !== token));
        setConfirmRevoke(null);
        try { await revokePortalLink(activeBrand.id, token); } catch { load(); }
    };

    if (!activeBrand) {
        return <div className="px-6 py-5"><p className="text-[13px] text-fg-muted">Elegí una marca para gestionar sus accesos.</p></div>;
    }

    return (
        <div className="px-6 py-5 max-w-[900px]">
            <div className="flex items-baseline gap-3 mb-1">
                <h1 className="text-[21px] font-semibold tracking-[-.01em]">Clientes</h1>
                <span className="text-[13px] text-fg-muted">{activeBrand.name}</span>
            </div>
            <p className="text-[12.5px] text-fg-muted mb-6">
                Cada persona tiene su propio link al portal. Ahí ve lo publicado, aprueba y pide.
            </p>

            {/* Alta */}
            <div className="rounded-[var(--radius-md)] border border-edge-subtle bg-surface-1 px-5 py-4 mb-6">
                <h2 className="text-[13.5px] font-semibold mb-3">Dar acceso a alguien</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                        placeholder="Nombre (ej: Euge)"
                        className="h-9 px-3 rounded-[var(--radius-sm)] bg-surface-2 border border-edge text-[13px] outline-none placeholder:text-fg-faint focus:border-[var(--color-edge-focus)] transition-colors w-[190px]"
                    />
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                        placeholder="Email (opcional)"
                        className="h-9 px-3 rounded-[var(--radius-sm)] bg-surface-2 border border-edge text-[13px] outline-none placeholder:text-fg-faint focus:border-[var(--color-edge-focus)] transition-colors w-[220px]"
                    />
                    <button
                        onClick={create}
                        disabled={!name.trim() || creating}
                        className="h-9 px-4 rounded-[var(--radius-sm)] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                    >
                        {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Crear link
                    </button>
                </div>
                {error && <p className="text-[12px] text-[var(--color-error)] mt-2">{error}</p>}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex items-center gap-2 text-fg-muted text-[13px] py-6">
                    <Loader2 size={14} className="animate-spin" /> Cargando…
                </div>
            ) : links.length === 0 ? (
                <p className="text-[13px] text-fg-muted py-2">
                    Todavía no le diste acceso a nadie de {activeBrand.name}.
                </p>
            ) : (
                <div className="border border-edge-subtle rounded-[var(--radius-md)] overflow-hidden">
                    {links.map((l) => (
                        <div key={l.token} className="flex items-center gap-3 px-4 py-3 border-b border-edge-subtle last:border-0">
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium">{l.name}</p>
                                <p className="text-[10.5px] font-mono text-fg-faint mt-0.5 truncate">
                                    {l.email ? `${l.email} · ` : ""}{l.token}
                                </p>
                            </div>

                            <button
                                onClick={() => copy(l.token)}
                                title="Copiar el link"
                                className="h-7 px-3 rounded-[var(--radius-sm)] border border-edge text-[11.5px] text-fg-muted hover:text-fg flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                {copied === l.token ? <><Check size={11} className="text-[var(--color-success)]" /> Copiado</> : <><Copy size={11} /> Copiar</>}
                            </button>
                            <a
                                href={portalUrl(l.token)}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir su portal como lo ve él"
                                className="w-7 h-7 rounded-[var(--radius-sm)] border border-edge text-fg-muted hover:text-fg flex items-center justify-center shrink-0"
                            >
                                <ExternalLink size={11} />
                            </a>

                            {confirmRevoke === l.token ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => revoke(l.token)}
                                        className="h-7 px-3 rounded-[var(--radius-sm)] bg-[var(--color-error)] text-white text-[11.5px] font-medium cursor-pointer"
                                    >
                                        Revocar
                                    </button>
                                    <button
                                        onClick={() => setConfirmRevoke(null)}
                                        className="h-7 px-2.5 rounded-[var(--radius-sm)] border border-edge text-[11.5px] text-fg-muted cursor-pointer"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmRevoke(l.token)}
                                    title="Revocar el acceso"
                                    className="w-7 h-7 rounded-[var(--radius-sm)] border border-edge text-fg-muted hover:text-[var(--color-error)] hover:border-[var(--color-error)] flex items-center justify-center cursor-pointer shrink-0"
                                >
                                    <Trash2 size={11} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* El link viejo de la marca. Sigue funcionando y no sabe quién es quién. */}
            {legacyToken && (
                <div className="mt-6 flex gap-2.5 rounded-[var(--radius-md)] border border-edge-subtle bg-surface-1 px-4 py-3">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-fg-faint" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] text-fg-secondary leading-relaxed">
                            Hay un link viejo de la marca dando vueltas — sirve para entrar, pero no sabe quién es
                            quién, así que los pedidos que llegan por ahí quedan sin nombre.
                        </p>
                        <p className="text-[10.5px] font-mono text-fg-faint mt-1.5">{legacyToken}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
