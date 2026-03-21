import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm flex gap-3 items-start [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border [&>svg]:text-foreground",
        destructive:
          "border-destructive/40 bg-destructive/5 text-destructive dark:border-destructive/50 [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-medium leading-none tracking-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="alert-description" className={cn("text-sm [&_p]:leading-relaxed text-muted-foreground", className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
