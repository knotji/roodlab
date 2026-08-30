import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:border-[var(--ring)] focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--ring)_35%,transparent)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)]",
      outline: "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-xs hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]",
      ghost: "text-[var(--foreground)] hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]",
    },
    size: { default: "h-9 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", icon: "size-9", auto: "" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
