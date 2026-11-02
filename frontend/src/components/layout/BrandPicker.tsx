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

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronsUpDown, LayoutGrid, Loader2, Search } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { cn } from "../../lib/utils";
import type { Brand } from "../../lib/api";


import { API_BASE } from "../../lib/config";
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Una marca está "cargada" cuando Studio ya sabe algo de ella: quién es, su identidad, su
 *  estrategia o algún asset. Antes sólo contaban caras, productos y prendas (criterio de moda), y una
 *  marca como Mi Saluteca —cliente activo, sin prendas— caía en «sin configurar». */
function isLoaded(b: Brand): boolean {
  const assets = (b.avatars?.length ?? 0) + (b.products?.length ?? 0) + (b.clothing?.length ?? 0)
    + (b.moodboards?.length ?? 0) + (b.logos?.length ?? 0);
  return assets > 0 || !!b.logo || !!b.strategy || !!b.designSystemUrl || (b.brandContext ?? "").trim().length > 40;
}

/** Grupos de la lista, en el mismo orden que el trabajo (operacion.md §1c). */
const GROUPS: { id: "plan" | "proyectos" | "cargar"; label: string; hint: string }[] = [
  { id: "plan", label: "Plan mensual", hint: "contenido todos los meses" },
  { id: "proyectos", label: "Proyectos", hint: "encargos" },
  { id: "cargar", label: "Por cargar", hint: "falta su ficha" },
];
const groupOf = (b: Brand) => (!isLoaded(b) ? "cargar" : b.workType === "plan" ? "plan" : "proyectos");

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

/** `top`: versión para la barra de arriba (studio-v2): chip compacto que abre hacia abajo.
 *  `client`: la que ve un cliente con más de una marca, o el equipo en la vista de cliente: sin grupos
 *  internos ni «Administrar marcas». */
export function BrandPicker({ collapsed = false, top = false, client = false }: { collapsed?: boolean; top?: boolean; client?: boolean }) {
  const { brands, activeBrand, setActiveBrandId, loading } = useBrand();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
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
    if (open) { setQ(""); setCursor(0); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  // Agrupadas por tipo de trabajo; las que todavía no tienen ficha, al final y atenuadas.
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (term ? brands.filter((b) => b.name.toLowerCase().includes(term)) : brands)
      .slice().sort((a, b) => a.name.localeCompare(b.name));
    if (client) return [{ id: "todas", label: "", hint: "", items: list }];
    return GROUPS.map((g) => ({ ...g, items: list.filter((b) => groupOf(b) === g.id) })).filter((g) => g.items.length);
  }, [brands, q, client]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

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
  const onKeys = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(flat.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter" && flat[cursor]) { e.preventDefault(); pick(flat[cursor].id); }
  };

  const Row = ({ b, muted }: { b: Brand; muted?: boolean }) => {
    const i = flat.indexOf(b);
    const on = activeBrand?.id === b.id;
    return (
      <button
        role="option"
        aria-selected={on}
        onClick={() => pick(b.id)}
        onMouseEnter={() => setCursor(i)}
        className={cn(
          "w-full h-9 flex items-center gap-2.5 px-2.5 rounded-[var(--radius-sm)] text-left transition-colors cursor-pointer",
          i === cursor ? "bg-[var(--color-surface-2)]" : "bg-transparent",
          muted && "opacity-60"
        )}
      >
        <Avatar brand={b} size={24} />
        <span className={cn("flex-1 min-w-0 text-[13.5px] truncate", on ? "text-fg font-medium" : "text-fg")}>{b.name}</span>
        {on && <Check size={14} className="text-[var(--color-brand)] shrink-0" />}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Cambiar de marca"
        className={cn(
          "group flex items-center rounded-[var(--radius-sm)] transition-colors cursor-pointer",
          top ? cn("h-9 gap-2 pl-1.5 pr-2 border bg-[var(--color-surface-1)] hover:border-[var(--color-edge-strong)] hover:bg-[var(--color-surface-2)]",
              open ? "border-[var(--color-edge-strong)]" : "border-edge")
            : "w-full hover:bg-[var(--color-surface-1)]",
          !top && (collapsed ? "justify-center p-1" : "gap-2.5 px-1.5 py-1.5")
        )}
      >
        <Avatar brand={activeBrand} size={top ? 22 : 26} />
        {top && (
          <>
            <span className="flex flex-col items-start leading-none">
              {!client && <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-fg-faint">Marca</span>}
              <span className="mt-[3px] text-[13px] text-fg max-w-[170px] truncate">{activeBrand?.name ?? "Elegí una marca"}</span>
            </span>
            <ChevronsUpDown size={13} className="ml-1 text-fg-faint group-hover:text-fg shrink-0" />
          </>
        )}
        {!top && !collapsed && (
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
          onKeyDown={onKeys}
          className={cn(
            "absolute z-50 w-[300px] rounded-[var(--radius-md)] border border-[var(--color-edge-strong)]",
            "bg-[var(--color-surface-1)] shadow-2xl overflow-hidden",
            top ? "left-0 top-full mt-2" : collapsed ? "left-full ml-2 bottom-0" : "left-0 right-0 bottom-full mb-2 w-auto min-w-[300px]"
          )}
        >
          <div className="flex items-center gap-2 px-3 h-11 border-b border-edge">
            <Search size={13} className="text-fg-faint shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setCursor(0); }}
              placeholder="Buscar marca…"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-fg placeholder:text-fg-faint outline-none"
            />
            <kbd className="font-mono text-[9.5px] text-fg-faint">↑↓ ⏎</kbd>
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5 flex flex-col">
            {groups.map((g, gi) => (
              <div key={g.id} className={cn("flex flex-col gap-px", gi > 0 && "mt-1.5 pt-1.5 border-t border-edge")}>
                {g.label && (
                  <div className="flex items-baseline justify-between px-2.5 pt-1 pb-1">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-fg-muted">{g.label}</span>
                    <span className="text-[10.5px] text-fg-faint">{g.hint}</span>
                  </div>
                )}
                {g.items.map((b) => <Row key={b.id} b={b} muted={g.id === "cargar"} />)}
              </div>
            ))}

            {flat.length === 0 && (
              <div className="px-2.5 py-4 text-[12.5px] text-fg-faint text-center">
                No hay marcas con ese nombre
              </div>
            )}
          </div>

          {!client && (
            <button
              onClick={() => { setOpen(false); navigate("/dashboard/brands"); }}
              className="w-full flex items-center gap-2 px-3 h-10 border-t border-edge text-[12px] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
            >
              <LayoutGrid size={12} />
              Administrar marcas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
