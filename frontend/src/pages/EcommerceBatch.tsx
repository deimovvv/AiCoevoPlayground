/**
 * Ecommerce Batch — prototipo visual.
 *
 * Esta página NO genera nada todavía. Es para validar el flujo:
 *   - Drop una carpeta de prendas (outfits)
 *   - Drop una carpeta de poses canónicas (front / 3-4 / side / back / detail)
 *   - Drop una carpeta de poses lifestyle (opcional, solo prendas "hero" las reciben)
 *   - El usuario marca tipo + hero por prenda
 *   - El sistema muestra cuántas imágenes saldrían y el costo estimado
 *
 * Cuando el flujo esté validado, se cablea contra Nano Banana 2 batch.
 * Por ahora "Generar" muestra un breakdown de lo que SE generaría.
 *
 * URL: /dashboard/ecommerce-batch (oculta del nav — directa por URL).
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Upload, X, Image as ImageIcon, Sparkles, Trash2,
    Shirt, FlaskConical, Info, CheckCircle2,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { cn } from "../lib/utils";

// ── Domain types ─────────────────────────────────────────────────────

type GarmentType = "top" | "pant" | "dress" | "shoes" | "accessory" | "other";

interface OutfitItem {
    id: string;
    file: File;
    previewUrl: string;   // data URL for thumbnail
    type: GarmentType;
    isHero: boolean;
}

interface PoseItem {
    id: string;
    file: File;
    previewUrl: string;
    label: string;        // short label (filename without ext)
}

const GARMENT_TYPES: Array<{ id: GarmentType; label: string }> = [
    { id: "top", label: "Top" },
    { id: "pant", label: "Pantalón" },
    { id: "dress", label: "Vestido" },
    { id: "shoes", label: "Calzado" },
    { id: "accessory", label: "Accesorio" },
    { id: "other", label: "Otro" },
];

// Compatibility matrix — qué poses son razonables para qué tipo de prenda.
// Por ahora es una heurística simple (1 = compatible, 0 = no). Después la afinamos.
// Tip mental: para esta versión, las canónicas se aplican a todas las prendas.
// La matriz va a importar cuando metamos clasificación auto de poses.
//
// NOTA al usuario: si te resulta abstracto, ignoralo por ahora — el contador
// abajo asume "todas las canónicas para todas las prendas".

// Aproximación de costo por imagen (Nano Banana 2 vía Fal).
const COST_PER_IMAGE_USD = 0.04;
const SECONDS_PER_IMAGE_AT_CONCURRENCY_3 = 5; // wall-clock real ~15s, dividido por 3 = ~5s

// ── Helpers ──────────────────────────────────────────────────────────

const niceFilename = (name: string): string =>
    name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
    });

const guessGarmentType = (filename: string): GarmentType => {
    const n = filename.toLowerCase();
    // Quick heuristic: regex over the filename. Lossy on purpose — user can override.
    if (/\b(remera|tshirt|top|camisa|sweater|hoodie|buzo|polera|tank|blusa)\b/.test(n)) return "top";
    if (/\b(pant|jean|short|skirt|pollera|falda|trouser|legging)\b/.test(n)) return "pant";
    if (/\b(dress|vestido|jumpsuit|enterizo|mono)\b/.test(n)) return "dress";
    if (/\b(shoe|zapat|sneaker|boot|bota|sandal|heel|tacon)\b/.test(n)) return "shoes";
    if (/\b(bag|cartera|hat|gorra|belt|cinturon|scarf|bufanda|ring|anillo|jewel|joya)\b/.test(n)) return "accessory";
    return "other";
};

// ── Drop zone ────────────────────────────────────────────────────────

function DropZone({
    label,
    hint,
    onFiles,
    accent,
}: {
    label: string;
    hint: string;
    onFiles: (files: File[]) => void;
    accent?: boolean;
}) {
    const [over, setOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        // Drag a folder → DataTransferItemList.webkitGetAsEntry walks the tree.
        // Drag files → e.dataTransfer.files is enough.
        const items = Array.from(e.dataTransfer.items || []);
        const filesFromTree: File[] = [];
        const walks: Promise<void>[] = [];

        for (const it of items) {
            // The `as { webkitGetAsEntry?: ... }` is to avoid `any` while staying portable.
            const entry = (it as unknown as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.();
            if (entry) {
                walks.push(walkEntry(entry, filesFromTree));
            } else {
                const f = it.getAsFile();
                if (f) filesFromTree.push(f);
            }
        }

        Promise.all(walks).then(() => {
            const onlyImages = filesFromTree.filter((f) => f.type.startsWith("image/"));
            if (onlyImages.length > 0) onFiles(onlyImages);
            else if (filesFromTree.length === 0 && e.dataTransfer.files.length > 0) {
                // Fallback path for browsers without DataTransferItem
                onFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
            }
        });
    };

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
                "border-2 border-dashed rounded-[var(--radius-md)] p-5 text-center cursor-pointer transition-colors",
                over
                    ? "border-[var(--color-action)] bg-[var(--color-action-subtle)]"
                    : accent
                        ? "border-[var(--color-action-muted)] bg-[var(--color-action-subtle)]/30 hover:border-[var(--color-action)]"
                        : "border-edge bg-surface-1 hover:border-fg-muted hover:bg-surface-2",
            )}
        >
            <Upload size={18} className="mx-auto text-fg-muted mb-2" />
            <p className="text-[13px] font-medium text-fg">{label}</p>
            <p className="text-[11px] text-fg-faint mt-1 leading-snug">{hint}</p>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*"
                // Letting the OS file picker also accept directories (Chromium-only attr,
                // gracefully ignored elsewhere). Plain file multi-select keeps working.
                {...({ webkitdirectory: "" } as Record<string, string>)}
                directory=""
                className="hidden"
                onChange={(e) => {
                    const fs = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
                    if (fs.length > 0) onFiles(fs);
                    e.target.value = "";
                }}
            />
        </div>
    );
}

// Recursively walk a FileSystemEntry (folder drag) and collect Files.
async function walkEntry(entry: FileSystemEntry, sink: File[]): Promise<void> {
    if (entry.isFile) {
        const fEntry = entry as FileSystemFileEntry;
        await new Promise<void>((resolve) => {
            fEntry.file((f) => { sink.push(f); resolve(); }, () => resolve());
        });
    } else if (entry.isDirectory) {
        const dEntry = entry as FileSystemDirectoryEntry;
        const reader = dEntry.createReader();
        await new Promise<void>((resolve) => {
            const readBatch = () => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) { resolve(); return; }
                    for (const e of entries) await walkEntry(e, sink);
                    readBatch();
                });
            };
            readBatch();
        });
    }
}

// ── Page ─────────────────────────────────────────────────────────────

export function EcommerceBatch() {
    const { activeBrand } = useBrand();
    const [outfits, setOutfits] = useState<OutfitItem[]>([]);
    const [canonicalPoses, setCanonicalPoses] = useState<PoseItem[]>([]);
    const [lifestylePoses, setLifestylePoses] = useState<PoseItem[]>([]);
    const [lifestyleK, setLifestyleK] = useState(2);

    // ── Drop handlers ────────────────────────────────────────────────
    const addOutfits = async (files: File[]) => {
        const items = await Promise.all(files.map(async (f, i) => ({
            id: `${Date.now()}_${i}_${f.name}`,
            file: f,
            previewUrl: await fileToDataUrl(f),
            type: guessGarmentType(f.name),
            isHero: false,
        })));
        setOutfits((prev) => [...prev, ...items]);
    };
    const addCanonical = async (files: File[]) => {
        const items = await Promise.all(files.map(async (f, i) => ({
            id: `${Date.now()}_${i}_${f.name}`,
            file: f,
            previewUrl: await fileToDataUrl(f),
            label: niceFilename(f.name),
        })));
        setCanonicalPoses((prev) => [...prev, ...items]);
    };
    const addLifestyle = async (files: File[]) => {
        const items = await Promise.all(files.map(async (f, i) => ({
            id: `${Date.now()}_${i}_${f.name}`,
            file: f,
            previewUrl: await fileToDataUrl(f),
            label: niceFilename(f.name),
        })));
        setLifestylePoses((prev) => [...prev, ...items]);
    };

    // ── Cost / count summary ─────────────────────────────────────────
    const summary = useMemo(() => {
        const N = outfits.length;
        const heroCount = outfits.filter((o) => o.isHero).length;
        const canonical = canonicalPoses.length;
        const lifestyleAvail = lifestylePoses.length;
        const effectiveLifestyleK = Math.min(lifestyleK, lifestyleAvail);

        // Cada prenda recibe TODAS las canónicas. Las hero también reciben K lifestyle.
        const canonicalImages = N * canonical;
        const lifestyleImages = heroCount * effectiveLifestyleK;
        const total = canonicalImages + lifestyleImages;
        const cost = total * COST_PER_IMAGE_USD;
        const seconds = total * SECONDS_PER_IMAGE_AT_CONCURRENCY_3;
        return {
            N, heroCount, canonical, lifestyleAvail, effectiveLifestyleK,
            canonicalImages, lifestyleImages, total, cost, seconds,
        };
    }, [outfits, canonicalPoses, lifestylePoses, lifestyleK]);

    // Clean up data URLs on unmount to free memory (the URLs themselves don't
    // hold OS resources, but the strings can be ~1MB each — let GC reclaim).
    useEffect(() => () => {
        // no-op (data URLs are reclaimed when the strings drop out of scope)
    }, []);

    const handleGenerate = () => {
        const breakdown = {
            brand: activeBrand?.name || "(sin marca)",
            outfits: outfits.map((o) => ({ name: o.file.name, type: o.type, hero: o.isHero })),
            canonical: canonicalPoses.map((p) => p.file.name),
            lifestyle: lifestylePoses.map((p) => p.file.name),
            lifestyleK,
            ...summary,
        };
        // Por ahora solo mostramos qué SE generaría. El batch real va después.
        console.log("[ecommerce-batch] would generate:", breakdown);
        alert(
            `Prototipo — todavía no genera.\n\n` +
            `Se generarían ${summary.total} imágenes:\n` +
            `  • ${summary.canonicalImages} canónicas (${summary.N} prendas × ${summary.canonical} poses)\n` +
            `  • ${summary.lifestyleImages} lifestyle (${summary.heroCount} hero × ${summary.effectiveLifestyleK} poses)\n\n` +
            `Costo estimado: $${summary.cost.toFixed(2)} · ~${Math.ceil(summary.seconds / 60)} min\n\n` +
            `(detalle completo en console)`
        );
    };

    const canGenerate = outfits.length > 0 && canonicalPoses.length > 0;

    return (
        <div className="flex-1 flex flex-col bg-bg overflow-hidden">
            {/* Header */}
            <div className="border-b border-edge px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-[16px] font-semibold text-fg flex items-center gap-2">
                        Ecommerce Batch
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                            prototipo
                        </span>
                    </h1>
                    <p className="text-[12px] text-fg-muted mt-0.5">
                        Drop una carpeta de prendas + una de poses, te muestro qué saldría. Todavía no genera — primero validamos el flujo.
                    </p>
                </div>
                {activeBrand && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 border border-edge">
                        <Shirt size={12} className="text-fg-muted" />
                        <span className="text-[12px] text-fg">{activeBrand.name}</span>
                    </div>
                )}
            </div>

            {/* Body: scrollable, contains the 3 columns + summary bar */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* The 3 drop zones at top */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <SectionTitle index="1" title="Prendas" hint="Lo que vas a fotografiar" />
                            <DropZone
                                label={outfits.length === 0 ? "Drop carpeta de prendas" : `${outfits.length} prendas — drop más`}
                                hint="Imágenes sueltas o una carpeta entera"
                                onFiles={addOutfits}
                                accent
                            />
                        </div>
                        <div className="space-y-2">
                            <SectionTitle index="2" title="Poses canónicas" hint="Front / 3-4 / side / back / detail" />
                            <DropZone
                                label={canonicalPoses.length === 0 ? "Drop carpeta de poses" : `${canonicalPoses.length} poses canónicas`}
                                hint="Todas las prendas reciben todas estas"
                                onFiles={addCanonical}
                            />
                        </div>
                        <div className="space-y-2">
                            <SectionTitle index="3" title="Poses lifestyle" hint="Opcional — solo para hero" />
                            <DropZone
                                label={lifestylePoses.length === 0 ? "Drop poses lifestyle" : `${lifestylePoses.length} lifestyle`}
                                hint="Solo prendas marcadas como hero las reciben"
                                onFiles={addLifestyle}
                            />
                        </div>
                    </div>

                    {/* Outfits grid — once there's anything to show */}
                    {outfits.length > 0 && (
                        <Panel
                            title={`Prendas cargadas (${outfits.length})`}
                            right={
                                <button
                                    onClick={() => setOutfits([])}
                                    className="text-[11px] text-fg-faint hover:text-fg flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 size={11} /> Limpiar todo
                                </button>
                            }
                        >
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {outfits.map((o) => (
                                    <OutfitCard
                                        key={o.id}
                                        item={o}
                                        onTypeChange={(t) => setOutfits((prev) => prev.map((x) => x.id === o.id ? { ...x, type: t } : x))}
                                        onHeroToggle={() => setOutfits((prev) => prev.map((x) => x.id === o.id ? { ...x, isHero: !x.isHero } : x))}
                                        onRemove={() => setOutfits((prev) => prev.filter((x) => x.id !== o.id))}
                                    />
                                ))}
                            </div>
                        </Panel>
                    )}

                    {/* Pose strips */}
                    {(canonicalPoses.length > 0 || lifestylePoses.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {canonicalPoses.length > 0 && (
                                <Panel
                                    title={`Canónicas (${canonicalPoses.length})`}
                                    right={
                                        <button
                                            onClick={() => setCanonicalPoses([])}
                                            className="text-[11px] text-fg-faint hover:text-fg flex items-center gap-1 cursor-pointer"
                                        >
                                            <Trash2 size={11} /> Limpiar
                                        </button>
                                    }
                                >
                                    <PoseStrip
                                        items={canonicalPoses}
                                        onRemove={(id) => setCanonicalPoses((prev) => prev.filter((p) => p.id !== id))}
                                    />
                                </Panel>
                            )}
                            {lifestylePoses.length > 0 && (
                                <Panel
                                    title={`Lifestyle (${lifestylePoses.length})`}
                                    right={
                                        <div className="flex items-center gap-3">
                                            <label className="text-[11px] text-fg-muted flex items-center gap-1.5">
                                                K por hero:
                                                <select
                                                    value={lifestyleK}
                                                    onChange={(e) => setLifestyleK(parseInt(e.target.value, 10))}
                                                    className="bg-surface-2 border border-edge rounded text-[11px] text-fg px-1.5 py-0.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                                >
                                                    {[1, 2, 3, 4].map((k) => (
                                                        <option key={k} value={k}>{k}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button
                                                onClick={() => setLifestylePoses([])}
                                                className="text-[11px] text-fg-faint hover:text-fg flex items-center gap-1 cursor-pointer"
                                            >
                                                <Trash2 size={11} /> Limpiar
                                            </button>
                                        </div>
                                    }
                                >
                                    <PoseStrip
                                        items={lifestylePoses}
                                        onRemove={(id) => setLifestylePoses((prev) => prev.filter((p) => p.id !== id))}
                                    />
                                </Panel>
                            )}
                        </div>
                    )}

                    {/* Empty state hint */}
                    {outfits.length === 0 && canonicalPoses.length === 0 && (
                        <div className="text-center py-12 text-fg-faint">
                            <FlaskConical size={28} className="mx-auto mb-2 text-fg-faint" />
                            <p className="text-[13px]">Tirá una carpeta de prendas en la primera caja para empezar.</p>
                            <p className="text-[11px] mt-1">Después una de poses canónicas (front / 3-4 / side / back).</p>
                        </div>
                    )}

                    {/* How it works — quick reminder, plain language */}
                    <Panel title="Cómo va a funcionar" subdued>
                        <ul className="text-[12px] text-fg-muted space-y-1.5 leading-relaxed">
                            <li className="flex gap-2">
                                <span className="text-[var(--color-action)] shrink-0">·</span>
                                <span><strong className="text-fg">Cada prenda</strong> recibe TODAS las poses canónicas. Así te queda el catálogo estándar (front, 3-4, side, back) para todas.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-[var(--color-action)] shrink-0">·</span>
                                <span><strong className="text-fg">Las marcadas hero</strong> también reciben K poses lifestyle random del segundo pool. Así no todas las prendas tienen la pose de "destacado" — solo las que vos elegís.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-[var(--color-action)] shrink-0">·</span>
                                <span><strong className="text-fg">Tipo de prenda</strong> es para que más adelante el sistema sepa qué pose tiene sentido con qué prenda (ej. pose sentada no va para zapatillas). Por ahora es solo etiqueta.</span>
                            </li>
                        </ul>
                    </Panel>
                </div>
            </div>

            {/* Sticky summary bar at bottom */}
            <SummaryBar
                summary={summary}
                canGenerate={canGenerate}
                onGenerate={handleGenerate}
            />
        </div>
    );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SectionTitle({ index, title, hint }: { index: string; title: string; hint: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-[var(--color-action)] bg-[var(--color-action-subtle)] rounded-full w-5 h-5 inline-flex items-center justify-center">
                {index}
            </span>
            <span className="text-[12px] font-semibold text-fg">{title}</span>
            <span className="text-[10px] text-fg-faint">— {hint}</span>
        </div>
    );
}

function Panel({
    title, right, subdued, children,
}: {
    title: string; right?: React.ReactNode; subdued?: boolean; children: React.ReactNode;
}) {
    return (
        <div className={cn(
            "border rounded-[var(--radius-md)] p-4",
            subdued ? "bg-surface-0 border-edge-subtle" : "bg-surface-1 border-edge",
        )}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-fg">{title}</span>
                {right}
            </div>
            {children}
        </div>
    );
}

function OutfitCard({
    item, onTypeChange, onHeroToggle, onRemove,
}: {
    item: OutfitItem;
    onTypeChange: (t: GarmentType) => void;
    onHeroToggle: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] overflow-hidden group">
            <div className="relative aspect-[3/4] bg-surface-0">
                <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                <button
                    onClick={onRemove}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-black flex items-center justify-center cursor-pointer transition-opacity"
                    title="Quitar"
                >
                    <X size={12} />
                </button>
                {item.isHero && (
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] text-[9px] font-bold uppercase tracking-wider">
                        <Sparkles size={9} /> Hero
                    </div>
                )}
            </div>
            <div className="p-2 space-y-1.5">
                <div className="text-[11px] text-fg truncate font-medium" title={item.file.name}>
                    {niceFilename(item.file.name)}
                </div>
                <select
                    value={item.type}
                    onChange={(e) => onTypeChange(e.target.value as GarmentType)}
                    className="w-full bg-surface-1 border border-edge rounded text-[11px] text-fg-secondary px-1.5 py-1 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                >
                    {GARMENT_TYPES.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                </select>
                <button
                    onClick={onHeroToggle}
                    className={cn(
                        "w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors",
                        item.isHero
                            ? "bg-[var(--color-action)] text-[var(--color-action-fg)]"
                            : "bg-surface-1 text-fg-muted hover:text-fg hover:bg-surface-0 border border-edge",
                    )}
                >
                    {item.isHero ? <CheckCircle2 size={11} /> : <Sparkles size={11} />}
                    {item.isHero ? "Es hero" : "Marcar hero"}
                </button>
            </div>
        </div>
    );
}

function PoseStrip({
    items, onRemove,
}: {
    items: PoseItem[]; onRemove: (id: string) => void;
}) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2">
            {items.map((p) => (
                <div key={p.id} className="shrink-0 w-24 group">
                    <div className="relative aspect-[3/4] bg-surface-0 rounded-[var(--radius-sm)] border border-edge overflow-hidden">
                        <img src={p.previewUrl} alt={p.label} className="w-full h-full object-cover" />
                        <button
                            onClick={() => onRemove(p.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-black flex items-center justify-center cursor-pointer transition-opacity"
                            title="Quitar"
                        >
                            <X size={10} />
                        </button>
                    </div>
                    <p className="text-[10px] text-fg-muted truncate mt-1" title={p.label}>{p.label}</p>
                </div>
            ))}
        </div>
    );
}

function SummaryBar({
    summary, canGenerate, onGenerate,
}: {
    summary: { N: number; heroCount: number; canonical: number; effectiveLifestyleK: number; lifestyleAvail: number; canonicalImages: number; lifestyleImages: number; total: number; cost: number; seconds: number };
    canGenerate: boolean;
    onGenerate: () => void;
}) {
    return (
        <div className="border-t border-edge bg-surface-0 px-6 py-3 shrink-0">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-5 text-[12px] flex-wrap">
                    <Counter label="Prendas" value={summary.N} icon={<Shirt size={11} />} />
                    <Counter label="Hero" value={summary.heroCount} icon={<Sparkles size={11} />} />
                    <Counter label="Canónicas" value={summary.canonical} icon={<ImageIcon size={11} />} />
                    <Counter label="Lifestyle" value={summary.lifestyleAvail} icon={<ImageIcon size={11} />} />
                    <span className="h-4 w-px bg-edge" />
                    <div className="flex items-center gap-2 text-fg-secondary">
                        <span className="text-[11px] text-fg-faint">Saldrían</span>
                        <span className="text-[14px] font-bold text-fg">{summary.total}</span>
                        <span className="text-[11px] text-fg-faint">imágenes</span>
                        {summary.total > 0 && (
                            <span className="text-[11px] text-fg-muted">
                                · ≈ ${summary.cost.toFixed(2)} · ~{Math.max(1, Math.ceil(summary.seconds / 60))} min
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={onGenerate}
                    disabled={!canGenerate}
                    title={canGenerate ? "Generar (todavía es stub — verifica el desglose)" : "Faltan prendas o poses canónicas"}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold transition-all cursor-pointer",
                        canGenerate
                            ? "bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90"
                            : "bg-surface-2 text-fg-faint cursor-not-allowed",
                    )}
                >
                    <Sparkles size={13} />
                    Generar
                    <Info size={10} className="opacity-60" />
                </button>
            </div>
        </div>
    );
}

function Counter({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 text-fg-muted">
            <span className="text-fg-faint">{icon}</span>
            <span className="text-[11px]">{label}</span>
            <span className="text-[12px] font-semibold text-fg">{value}</span>
        </div>
    );
}
