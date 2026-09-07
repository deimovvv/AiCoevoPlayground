/**
 * BrandPicker — el selector de marca de verdad
 * ─────────────────────────────────────────────
 * Antes esto era un link: tocabas el chip de marca y te sacaba a /dashboard/brands,
 * o sea que para cambiar de marca tenías que abandonar lo que estabas haciendo.
 * Siendo que "elegís una marca y todo hereda su contexto" es LA idea del producto,
 * cambiarla tenía que costar un click desde cualquier pantalla.
 *
 * Ahora despliega la lista y cambia el contexto en el lugar. El acceso a la
 * pantalla de marcas sigue estando, abajo de todo, como acción secundaria.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronsUpDown, LayoutGrid, Loader2, Search } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { cn } from "../../lib/utils";
import type { Brand } from "../../lib/api";

const API_BASE = "http://127.0.0.1:8000";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Una marca está "lista" cuando tiene con qué generar. Es el mismo criterio que
 *  la grilla de Marcas usa para el estado ACTIVA / BORRADOR. */
function isReady(b: Brand): boolean {
  const anyAsset =
    (b.avatars?.length ?? 0) + (b.products?.length ?? 0) + (b.clothing?.length ?? 0);
  return anyAsset > 0;
}

function Avatar({ brand, size = 26 }: { brand: Brand | null; size?: number }) {
  const logo = brand?.logo?.imageUrl;
  return (
    <div
      className="rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 overflow-hidden bg-[var(--color-action-muted)]"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img src={`${API_BASE}${logo}`} alt="" className="max-w-full max-h-full object-contain p-0.5 bg-white" />
      ) : (
        <span className="text-[9px] font-bold text-[var(--color-action)] leading-none">
          {brand ? initials(brand.name) : "?"}
        </span>
      )}
    </div>
  );
}

export function BrandPicker({ collapsed = false }: { collapsed?: boolean }) {
  const { brands, activeBrand, setActiveBrandId, loading } = useBrand();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  // Las que ya se pueden usar arriba; las que están a medio cargar, abajo y atenuadas.
  // Con 13 marcas y varias sin configurar, mezclarlas hacía que la lista no se leyera.
  const { ready, draft } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? brands.filter((b) => b.name.toLowerCase().includes(term)) : brands;
    return {
      ready: list.filter(isReady).sort((a, b) => a.name.localeCompare(b.name)),
      draft: list.filter((b) => !isReady(b)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [brands, q]);

  if (loading) {
    return (
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2 px-1")}>
        <div className="w-[26px] h-[26px] flex items-center justify-center rounded-[var(--radius-sm)] bg-surface-1 text-fg-muted">
          <Loader2 size={12} className="animate-spin" />
        </div>
        {!collapsed && <span className="text-[12px] text-fg-muted">Cargando…</span>}
      </div>
    );
  }

  const pick = (id: string) => { setActiveBrandId(id); setOpen(false); };

  const Row = ({ b, muted }: { b: Brand; muted?: boolean }) => (
    <button
      key={b.id}
      onClick={() => pick(b.id)}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-left transition-colors cursor-pointer",
        "hover:bg-[var(--color-surface-2)]",
        muted && "opacity-55"
      )}
    >
      <Avatar brand={b} size={22} />
      <span className="flex-1 min-w-0 text-[13px] text-fg truncate">{b.name}</span>
      {muted && <span className="text-[9.5px] text-fg-faint shrink-0">sin assets</span>}
      {activeBrand?.id === b.id && <Check size={13} className="text-[var(--color-action)] shrink-0" />}
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={activeBrand ? `Marca activa: ${activeBrand.name}` : "Elegir marca"}
        className={cn(
          "w-full flex items-center rounded-[var(--radius-sm)] transition-colors cursor-pointer",
          "hover:bg-[var(--color-surface-1)]",
          collapsed ? "justify-center p-1" : "gap-2.5 px-1.5 py-1.5"
        )}
      >
        <Avatar brand={activeBrand} />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12.5px] font-semibold text-fg truncate leading-tight">
                {activeBrand?.name ?? "Sin marca"}
              </div>
              <div className="text-[9.5px] text-fg-faint leading-tight mt-px">marca activa</div>
            </div>
            <ChevronsUpDown size={13} className="text-fg-faint shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 w-[248px] rounded-[var(--radius-md)] border border-edge",
            "bg-[var(--color-surface-1)] shadow-xl overflow-hidden",
            collapsed ? "left-full ml-2 bottom-0" : "left-0 right-0 bottom-full mb-2 w-auto min-w-[248px]"
          )}
        >
          {brands.length > 6 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
              <Search size={12} className="text-fg-faint shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar marca…"
                className="flex-1 min-w-0 bg-transparent text-[12.5px] text-fg placeholder:text-fg-faint outline-none"
              />
            </div>
          )}

          <div className="max-h-[320px] overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {ready.map((b) => <Row key={b.id} b={b} />)}

            {draft.length > 0 && (
              <>
                {ready.length > 0 && <div className="h-px bg-edge my-1 mx-1.5" />}
                <div className="px-2.5 pt-1 pb-1 text-[9.5px] uppercase tracking-wider text-fg-faint">
                  Sin configurar
                </div>
                {draft.map((b) => <Row key={b.id} b={b} muted />)}
              </>
            )}

            {ready.length === 0 && draft.length === 0 && (
              <div className="px-2.5 py-4 text-[12.5px] text-fg-faint text-center">
                No hay marcas con ese nombre
              </div>
            )}
          </div>

          <button
            onClick={() => { setOpen(false); navigate("/dashboard/brands"); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-edge text-[12px] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <LayoutGrid size={12} />
            Administrar marcas
          </button>
        </div>
      )}
    </div>
  );
}
