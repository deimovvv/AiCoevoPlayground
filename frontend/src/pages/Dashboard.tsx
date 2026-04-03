import { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Settings, ArrowRight, Folder, Activity, Plus, X,
    Trash2, Loader2, AlertCircle, Users,
} from "lucide-react";
import { useNavigate } from "react-router";
import { fetchBrands, createBrand, deleteBrand, type Brand } from "../lib/api";
import { useBrand } from "../lib/BrandContext";

export function Dashboard() {
    const navigate = useNavigate();
    const { refreshBrands } = useBrand();
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Add Brand modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newBrandName, setNewBrandName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadBrands = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchBrands();
            setBrands(data);
        } catch (err: any) {
            setError(err.message || "Failed to load brands");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBrands();
    }, []);

    useEffect(() => {
        if (showAddModal) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
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
            setCreateError(err.message || "Failed to create brand");
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
            setError(err.message || "Failed to delete brand");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-semibold text-fg tracking-tight">Brands</h1>
                    <p className="text-fg-muted text-[13px] mt-0.5">Select a brand to manage scripts and generate videos.</p>
                </div>
                <Button variant="default" size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5">
                    <Plus size={14} /> Add Brand
                </Button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-fg-muted" />
                    <span className="text-fg-muted text-sm ml-2">Loading brands...</span>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] border border-error/20 bg-error-muted text-error text-sm">
                    <AlertCircle size={16} />
                    {error}
                    <button onClick={loadBrands} className="ml-auto text-xs font-medium underline cursor-pointer">Retry</button>
                </div>
            )}

            {/* Brand Cards */}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {brands.map((brand) => (
                        <div
                            key={brand.id}
                            className="group border border-edge rounded-[var(--radius-md)] bg-surface-0 hover:border-edge-strong transition-all duration-150 cursor-pointer"
                            onClick={() => navigate(`/dashboard/brands/${brand.id}`)}
                        >
                            <div className="p-4">
                                {/* Top row: icon + settings */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-accent-muted flex items-center justify-center">
                                        <Folder size={14} className="text-accent" />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-faint hover:text-error hover:bg-error-muted transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(brand.id); }}
                                            title="Delete brand"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                        <button
                                            className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-faint hover:text-fg-secondary hover:bg-surface-2 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/brands/${brand.id}`); }}
                                        >
                                            <Settings size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Name */}
                                <h3 className="text-[14px] font-medium text-fg">{brand.name}</h3>
                                <p className="text-[12px] text-fg-faint font-mono mt-0.5">{brand.id}</p>

                                {/* Stats row */}
                                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-edge-subtle">
                                    <div className="flex items-center gap-1.5">
                                        <Users size={12} className="text-fg-faint" />
                                        <span className="text-[14px] font-semibold text-fg tabular-nums">{brand.avatars?.length || 0}</span>
                                        <span className="text-[11px] text-fg-muted">avatars</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Activity size={12} className="text-fg-faint" />
                                        <span className="text-[11px] text-fg-muted">{brand.voicePresets?.length || 0} voices</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer action */}
                            <div className="px-4 py-2.5 border-t border-edge-subtle flex items-center justify-between">
                                <span className="text-[12px] text-fg-muted font-medium group-hover:text-accent transition-colors">Open Workspace</span>
                                <ArrowRight size={13} className="text-fg-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                            </div>
                        </div>
                    ))}

                    {/* Empty state */}
                    {brands.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-12 h-12 rounded-full bg-surface-1 flex items-center justify-center mb-3">
                                <Folder size={20} className="text-fg-faint" />
                            </div>
                            <p className="text-fg-secondary text-sm font-medium">No brands yet</p>
                            <p className="text-fg-muted text-xs mt-1">Create your first brand to get started.</p>
                            <Button variant="default" size="sm" className="mt-4 flex items-center gap-1.5" onClick={() => setShowAddModal(true)}>
                                <Plus size={14} /> Create Brand
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* ====== ADD BRAND MODAL ====== */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setCreateError(null); }} />
                    <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-lg w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-edge">
                            <div>
                                <h2 className="text-[16px] font-semibold text-fg">New Brand</h2>
                                <p className="text-[12px] text-fg-muted mt-0.5">Add a new brand to manage its avatars and videos.</p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); setCreateError(null); }} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="brand-name">Brand Name</Label>
                                <Input
                                    ref={inputRef}
                                    id="brand-name"
                                    placeholder="e.g. Taller Santa Clara"
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
                            <Button variant="outline" onClick={() => { setShowAddModal(false); setCreateError(null); }}>Cancel</Button>
                            <Button
                                variant="default"
                                disabled={!newBrandName.trim() || creating}
                                onClick={handleCreate}
                                className={`flex items-center gap-1.5 ${!newBrandName.trim() ? 'opacity-50' : ''}`}
                            >
                                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {creating ? "Creating..." : "Create Brand"}
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
                            <h2 className="text-[16px] font-semibold text-fg">Delete Brand?</h2>
                            <p className="text-[13px] text-fg-muted">
                                This will permanently delete <strong className="text-fg">{brands.find(b => b.id === deleteTarget)?.name}</strong> and all its avatars. This action cannot be undone.
                            </p>
                        </div>
                        <div className="p-5 border-t border-edge flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                            <Button
                                variant="default"
                                className="bg-error hover:bg-error/90 text-white flex items-center gap-1.5"
                                disabled={deleting}
                                onClick={() => handleDelete(deleteTarget)}
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                {deleting ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
