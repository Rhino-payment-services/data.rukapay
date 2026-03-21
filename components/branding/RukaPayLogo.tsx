import Image from "next/image";

import { cn } from "@/lib/utils";

/** Public path to the RukaPay mark (same asset as merchant / partners dashboards). */
export const RUKAPAY_LOGO_SRC = "/images/logo.jpg";

type RukaPayLogoMarkProps = {
  className?: string;
  /** Square logo size in pixels (default 40). */
  size?: number;
  priority?: boolean;
};

/**
 * RukaPay square logo mark — use beside titles or centered on auth screens.
 */
export function RukaPayLogoMark({ className, size = 40, priority }: RukaPayLogoMarkProps) {
  return (
    <Image
      src={RUKAPAY_LOGO_SRC}
      alt="RukaPay"
      width={size}
      height={size}
      className={cn("rounded-lg object-cover shadow-sm shrink-0", className)}
      priority={priority}
    />
  );
}
