import Image from "next/image";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Brand lockup, used by the login screen and the sidebar.
 *
 * Intrinsic size is 2611×844 (a ~3.09:1 horizontal lockup). The width/height
 * given to <Image> keeps that ratio so Next can reserve the right box and the
 * layout does not shift while the file loads — the reason the placeholder it
 * replaced was a fixed-size skeleton.
 *
 * `priority` because it is above the fold on both screens it appears in.
 */
export function BrandLogo({
  className,
  imageClassName,
}: {
  className?: string;
  /**
   * Sizing for the image itself. The wrapper's className cannot do it, since
   * the height lives here — so callers that need a different size (the sidebar
   * runs larger than the login) override this rather than fork the component.
   */
  imageClassName?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Image
        src="/logo_horizontal.png"
        alt={es.login.logoAlt}
        width={220}
        height={71}
        priority
        className={cn("w-auto object-contain", imageClassName ?? "h-10")}
      />
    </div>
  );
}
