import { es } from "@/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Brand lockup. The real asset is not in the repo yet, so it renders a skeleton
 * placeholder of the final dimensions: swapping it for <Image /> later will not
 * shift the layout.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="img"
      aria-label={es.login.logoAlt}
    >
      <Skeleton className="h-10 w-[220px] rounded-lg" />
    </div>
  );
}
