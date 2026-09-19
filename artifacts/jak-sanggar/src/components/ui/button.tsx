import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border border-destructive-border hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border [border-color:var(--button-outline)] shadow-xs bg-background/50 hover:bg-accent/10 hover:border-accent/50 hover:text-accent-foreground active:shadow-none",
        secondary:
          "border bg-secondary text-secondary-foreground border-secondary-border hover:bg-secondary/80",
        ghost: "border border-transparent hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-accent",
        gold: "btn-gold border-0 hover:scale-[1.02] active:scale-100",
        accent: "bg-accent text-accent-foreground border border-[hsl(38_55%_38%)] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-11 rounded-md px-7 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
