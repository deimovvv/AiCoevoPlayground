import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-8 w-full rounded-[var(--radius-sm)] border border-edge bg-control px-3 py-1 text-[13px] text-fg placeholder:text-fg-muted transition-colors duration-150 focus:outline-none focus:border-[var(--color-edge-focus)] focus:ring-1 focus:ring-[var(--color-edge-focus)] disabled:cursor-not-allowed disabled:opacity-40",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
