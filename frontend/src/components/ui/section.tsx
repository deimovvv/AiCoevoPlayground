import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Section — canonical grouping block for forms and panels.
 * Encodes the "fino con filo" header style: optional uppercase eyebrow + title.
 * Use this instead of ad-hoc bordered divs so every grouped block looks the same.
 * See docs/design_language.md.
 */
export function Section({
  title,
  eyebrow,
  icon,
  action,
  children,
  className,
  bare,
}: {
  title?: string;
  /** Small uppercase label above/inline the title — the "manifesto" accent. */
  eyebrow?: string;
  icon?: React.ReactNode;
  /** Optional right-aligned control (e.g. a toggle or link). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** When true, no card chrome — just the header + content (for nesting). */
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        !bare && "bg-surface-1 border border-edge rounded-[var(--radius-md)] p-5",
        className,
      )}
    >
      {(title || eyebrow) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-fg-muted shrink-0">{icon}</span>}
            <div className="min-w-0">
              {eyebrow && (
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-faint">{eyebrow}</div>
              )}
              {title && <h3 className="text-[14px] font-semibold text-fg truncate">{title}</h3>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Collapsible — expandable "Avanzado" section. Keep core fields outside; tuck
 * optional/advanced ones in here so forms don't overwhelm. Closed by default.
 */
export function Collapsible({
  title,
  eyebrow,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn("bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <div className="text-left">
          {eyebrow && <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-faint">{eyebrow}</div>}
          <span className="text-[13px] font-semibold text-fg">{title}</span>
        </div>
        <ChevronDown size={16} className={cn("text-fg-muted transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-4 border-t border-edge">{children}</div>}
    </div>
  );
}
