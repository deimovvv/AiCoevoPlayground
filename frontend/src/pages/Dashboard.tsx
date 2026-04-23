import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Plus, X, Trash2, Loader2, AlertCircle,
    Search, Palette,
} from "lucide-react";
import { useNavigate } from "react-router";
import { fetchBrands, createBrand, deleteBrand, type Brand } from "../lib/api";
import { useBrand } from "../lib/BrandContext";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:8000";

type FilterKey = "all" | "with_dna" | "with_design_system" | "incomplete";

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "with_dna", label: "Con DNA" },
    { key: "with_design_system", label: "Con Design System" },
    { key: "incomplete", label: "Sin configurar" },
];

export function Dashboard() {
    const navigate = useNavigate();
    const { refreshBrands, setActiveBrandId } = useBrand();
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterKey>("all");

    const [showAddModal, setShowAddModal] = useState(false);
    const [newBrandName, setNewBrandName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadBrands = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchBrands();
            // Sandbox goes to the end visually
            setBrands(data.filter((b) => !b.isSandbox));
        } catch (err: any) {
            setError(err.message || "No se pudieron cargar las marcas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadBrands(); }, []);
    useEffect(() => {
        if (showAddModal) setTimeout(() => inputRef.current?.focus(), 100);
    }, [showAddModal]);

    const handleCreate = async () => {
        if (!newBrandName.trim()) return;
        setCreating(true);
        setCreateError(null);
        try {
            await createBrand(newBrandName.trim());
            setShowAddModal(false);
            setNewBrandName("");
            await loadBrands();
            await refreshBrands();
        } catch (err: any) {
            setCreateError(err.message || "No se pudo crear la marca");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (brandId: string) => {
        setDeleting(true);
        try {
            await deleteBrand(brandId);
            setDeleteTarget(null);
            await loadBrands();
            await refreshBrands();
        } catch (err: any) {
            setError(err.message || "No se pudo eliminar la marca");
        } finally {
            setDeleting(false);
        }
    };

    const filtered = useMemo(() => {
        let list = brands;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
        }
        if (filter === "with_dna") list = list.filter((b) => !!b.dna);
        else if (filter === "with_design_system") list = list.filter((b) => !!b.designSystem);
        else if (filter === "incomplete") list = list.filter((b) => !b.dna || !b.designSystem || !b.brandContext?.trim());
        return list;
    }, [brands, search, filter]);

    return (
        <div className="space-y-8">
            {/* Header — editorial */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="space-y-2">
                    <h1 className="text-[36px] font-bold text-fg tracking-[-0.03em] leading-none">
                        Marcas.
                    </h1>
                    <p className="text-fg-muted text-[14px]">
                        {brands.length > 0
                            ? `${brands.length} ${brands.length === 1 ? "marca" : "marcas"} en tu workspace`
                            : "Creá tu primera marca para empezar"}
                    </p>
                </div>
                <Button variant="default" size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 shrink-0">
                    <Plus size={14} /> Nueva marca
                </Button>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px] max-w-md relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar marcas..."
                        className="w-full bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-full pl-10 pr-4 py-2.5 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--glass-border-hover)] focus:bg-[var(--glass-bg-hover)] transition-all"
                    />
                </div>
                <div className="flex items-center gap-1 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-full p-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                "px-3.5 py-1.5 text-[12px] font-medium rounded-full transition-all cursor-pointer",
                                filter === f.key
                                    ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)] shadow-sm"
                                    : "text-fg-muted hover:text-fg"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-fg-muted" />
                    <span className="text-fg-muted text-sm ml-2">Cargando marcas...</span>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] border border-error/20 bg-error-muted text-error text-sm">
                    <AlertCircle size={16} />
                    {error}
                    <button onClick={loadBrands} className="ml-auto text-xs font-medium underline cursor-pointer">Reintentar</button>
                </div>
            )}

            {/* Brand Cards */}
            {!loading && (
                <>
                    {filtered.length === 0 && brands.length > 0 && (
                        <div className="text-center py-16 text-fg-muted text-[13px]">
                            Sin resultados para esta búsqueda.
                        </div>
                    )}

                    {brands.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-14 h-14 rounded-full bg-surface-1 flex items-center justify-center mb-4">
                                <Palette size={22} className="text-fg-faint" />
                            </div>
                            <p className="text-fg-secondary text-[14px] font-medium">Todavía no hay marcas</p>
                            <p className="text-fg-muted text-[12px] mt-1">Creá tu primera marca para empezar a generar contenido.</p>
                            <Button variant="default" size="sm" className="mt-4 flex items-center gap-1.5" onClick={() => setShowAddModal(true)}>
                                <Plus size={14} /> Crear marca
                            </Button>
                        </div>
                    )}

                    {filtered.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filtered.map((brand) => (
                                <BrandCard
                                    key={brand.id}
                                    brand={brand}
                                    onOpen={() => {
                                        setActiveBrandId(brand.id);
                                        navigate(`/dashboard/brand`);
                                    }}
                                    onDelete={() => setDeleteTarget(brand.id)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ====== ADD BRAND MODAL ====== */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setCreateError(null); }} />
                    <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-lg w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-edge">
                            <div>
                                <h2 className="text-[16px] font-semibold text-fg">Nueva marca</h2>
                                <p className="text-[12px] text-fg-muted mt-0.5">Agregá una nueva marca para gestionar sus assets y generar contenido.</p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); setCreateError(null); }} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="brand-name">Nombre de la marca</Label>
                                <Input
                                    ref={inputRef}
                                    id="brand-name"
                                    placeholder="ej. Taller Santa Clara"
                                    value={newBrandName}
                                    onChange={(e) => setNewBrandName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                                />
                                {newBrandName.trim() && (
                                    <p className="text-[11px] text-fg-faint font-mono">
                                        ID: {newBrandName.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}
                                    </p>
                                )}
                            </div>
                            {createError && (
                                <p className="text-xs text-error flex items-center gap-1"><AlertCircle size={12} /> {createError}</p>
                            )}
                        </div>
                        <div className="p-5 border-t border-edge flex justify-end gap-3 bg-surface-0">
                            <Button variant="outline" onClick={() => { setShowAddModal(false); setCreateError(null); }}>Cancelar</Button>
                            <Button
                                variant="default"
                                disabled={!newBrandName.trim() || creating}
                                onClick={handleCreate}
                                className={`flex items-center gap-1.5 ${!newBrandName.trim() ? 'opacity-50' : ''}`}
                            >
                                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {creating ? "Creando..." : "Crear marca"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== DELETE CONFIRMATION MODAL ====== */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-lg w-full max-w-sm overflow-hidden">
                        <div className="p-5 space-y-3">
                            <div className="w-10 h-10 rounded-full bg-error-muted flex items-center justify-center">
                                <Trash2 size={18} className="text-error" />
                            </div>
                            <h2 className="text-[16px] font-semibold text-fg">¿Eliminar marca?</h2>
                            <p className="text-[13px] text-fg-muted">
                                Vas a eliminar <strong className="text-fg">{brands.find(b => b.id === deleteTarget)?.name}</strong> y todos sus assets permanentemente. Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="p-5 border-t border-edge flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                            <Button
                                variant="default"
                                className="bg-error hover:bg-error/90 text-white flex items-center gap-1.5"
                                disabled={deleting}
                                onClick={() => handleDelete(deleteTarget)}
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                {deleting ? "Eliminando..." : "Eliminar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BrandCard({ brand, onOpen, onDelete }: { brand: Brand; onOpen: () => void; onDelete: () => void }) {
    const colors = brand.dna?.colors || [];
    const hasDNA = !!brand.dna;
    const hasDesignSystem = !!brand.designSystem;
    const hasContext = !!brand.brandContext?.trim();
    const isReady = hasContext && hasDNA && hasDesignSystem;

    const initials = brand.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const heroColor = colors[0]?.hex;

    return (
        <div
            className="glass-sheen group relative bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[var(--radius-md)] overflow-hidden cursor-pointer transition-all duration-500 hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)] hover:shadow-[0_20px_50px_-20px_rgba(250,205,234,0.12)]"
            onClick={onOpen}
        >
            {/* Hero band — brand color or neutral */}
            <div
                className="h-20 relative overflow-hidden"
                style={{
                    backgroundColor: heroColor || "var(--color-surface-1)",
                    backgroundImage: heroColor
                        ? `linear-gradient(135deg, ${heroColor} 0%, ${colors[1]?.hex || heroColor} 100%)`
                        : undefined,
                }}
            >
                {/* Delete — subtle, hover only */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 backdrop-blur text-white/80 hover:bg-black/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                    title="Eliminar"
                >
                    <Trash2 size={10} />
                </button>
            </div>

            {/* Logo overlapping the band */}
            <div className="px-5 relative">
                <div className="-mt-8 mb-3">
                    {brand.logo?.imageUrl ? (
                        <div className="w-14 h-14 rounded-[var(--radius-md)] bg-white border border-edge shadow-sm flex items-center justify-center overflow-hidden">
                            <img
                                src={`${API_BASE}${brand.logo.imageUrl}`}
                                alt={brand.name}
                                className="max-w-full max-h-full object-contain p-1.5"
                            />
                        </div>
                    ) : (
                        <div
                            className="w-14 h-14 rounded-[var(--radius-md)] bg-surface-0 border border-edge shadow-sm flex items-center justify-center font-semibold text-[16px] tracking-tight"
                            style={{ color: heroColor || "var(--color-fg)" }}
                        >
                            {initials}
                        </div>
                    )}
                </div>

                {/* Name */}
                <h3 className="text-[15px] font-semibold text-fg tracking-tight truncate leading-tight">
                    {brand.name}
                </h3>

                {/* Subtle state line */}
                <p className="text-[11px] text-fg-faint mt-1">
                    {isReady ? "Listo para generar" : "Configuración pendiente"}
                </p>
            </div>

            {/* Bottom row — color palette + readiness dot */}
            <div className="px-5 py-4 mt-2 flex items-center justify-between border-t border-edge-subtle">
                {colors.length > 0 ? (
                    <div className="flex items-center gap-1">
                        {colors.slice(0, 5).map((c, i) => (
                            <div
                                key={i}
                                className="w-3 h-3 rounded-full ring-1 ring-edge"
                                style={{ backgroundColor: c.hex }}
                                title={`${c.name} — ${c.hex}`}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-fg-faint">
                        <Palette size={11} />
                        <span className="text-[10px]">Sin paleta</span>
                    </div>
                )}

                <div className="flex items-center gap-1.5">
                    <div
                        className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isReady ? "bg-green-400" : "bg-fg-faint"
                        )}
                    />
                    <span className="text-[10px] text-fg-faint uppercase tracking-wider font-medium">
                        {isReady ? "Activa" : "Borrador"}
                    </span>
                </div>
            </div>
        </div>
    );
}
