import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    // action = lime, the PRIMARY call-to-action ("Generar"). brand = pink, identity moments.
    // See docs/design_language.md — Lime is for action, Pink is for brand.
    variant?: "default" | "action" | "brand" | "outline" | "ghost" | "destructive"
    size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-edge-focus)] disabled:pointer-events-none disabled:opacity-40",
                    {
                        "border border-edge-strong bg-surface-2 text-fg hover:bg-surface-3 hover:border-[rgba(255,255,255,0.22)]": variant === "default",
                        // Primary action — lime, with a subtle glow on hover. The "do it" button.
                        "bg-[var(--color-action)] text-[var(--color-action-fg)] font-semibold hover:brightness-105 hover:shadow-[0_4px_20px_-6px_var(--color-action)]": variant === "action",
                        // Brand — pink, for identity moments (not primary action).
                        "bg-[var(--color-warm)] text-[var(--color-warm-fg)] font-semibold hover:opacity-90": variant === "brand",
                        "border border-edge bg-surface-1 text-fg hover:bg-surface-2 hover:border-edge-strong": variant === "outline",
                        "text-fg-secondary hover:text-fg hover:bg-surface-1": variant === "ghost",
                        "bg-error text-white hover:brightness-110": variant === "destructive",
                        "h-9 px-4 py-1.5": size === "default",
                        "h-8 px-3 text-xs": size === "sm",
                        "h-11 px-5": size === "lg",
                        "h-9 w-9": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
