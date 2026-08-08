import type { ReactNode } from "react";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { LoginCarousel } from "@/components/auth/LoginCarousel";
import { cn } from "@/lib/utils";

export type AuthSplitLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /**
   * Width of the centred column. Login is a single field and reads best narrow;
   * the onboarding form has four and needs more room.
   */
  contentClassName?: string;
};

/**
 * The split screen shared by login and onboarding: form on the left, image
 * carousel on the right.
 *
 * Extracted from the login page so the two screens cannot drift apart. The
 * carousel and its captions are untouched — this only frames them.
 *
 * On mobile the carousel is dropped entirely and the form takes the full width,
 * which is the whole responsive difference.
 */
export function AuthSplitLayout({
  title,
  subtitle,
  children,
  contentClassName,
}: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      {/* py-8 and a scrollable column: with the larger logo and two fields the
          content can outgrow a short desktop viewport, and a centred flex child
          that overflows loses its top edge with no way to scroll back to it. */}
      <section className="flex w-full flex-col justify-center overflow-y-auto px-6 py-8 lg:w-1/2 lg:px-16">
        <div
          className={cn(
            "mx-auto flex w-full flex-col",
            contentClassName ?? "max-w-[340px]"
          )}
        >
          {/* Larger than the sidebar's: on the auth screens the lockup is the
              only branding on the page, so it carries more weight. */}
          <BrandLogo className="mb-6" imageClassName="h-16" />

          {/* Design: 36px / weight 500 / #1E1E1E */}
          <h1 className="text-center text-4xl font-medium text-ink-900">
            {title}
          </h1>
          {/* Design: 16px / weight 400 / #848484 */}
          <p className="mt-3 text-center text-base leading-relaxed text-ink-500">
            {subtitle}
          </p>

          {children}
        </div>
      </section>

      {/*
        Carousel is desktop-only by design.

        Pinned at exactly one viewport tall and sticky at the top: when the form
        on the left is longer than the screen (the onboarding one is), only that
        column scrolls — the image stays put instead of being stretched to the
        page's full height or drifting up with the scroll.
      */}
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-dvh lg:w-1/2 lg:shrink-0 lg:self-start lg:overflow-hidden">
        <LoginCarousel />
      </aside>
    </div>
  );
}
