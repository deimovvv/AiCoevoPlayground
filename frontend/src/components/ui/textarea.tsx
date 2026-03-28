import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-[var(--radius-sm)] border border-edge bg-control px-3 py-2 text-[13px] text-fg placeholder:text-fg-muted transition-colors duration-150 focus:outline-none focus:border-[var(--color-edge-focus)] focus:ring-1 focus:ring-[var(--color-edge-focus)] disabled:cursor-not-allowed disabled:opacity-40 resize-none",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"

export { Textarea }
