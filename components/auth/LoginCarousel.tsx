"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { es } from "@/i18n";
import type { LoginSlide } from "@/lib/site/login-slides";
import { cn } from "@/lib/utils";

/** Time each slide stays on screen before advancing on its own. */
const AUTOPLAY_MS = 10_000;

export type LoginCarouselProps = {
  /**
   * Slides to show, already resolved by the server (the ones configured in the
   * panel, or the bundled ones). Never empty: see lib/site/login-slides.ts.
   */
  slides: LoginSlide[];
};

/**
 * Decorative panel on the right half of the login screen. Advances on its own
 * every 10s and on dot click; a manual pick restarts the timer so the slide the
 * user chose gets its full turn.
 *
 * Hidden on mobile by the page layout: the small screen keeps only the form.
 *
 * The images come from the database (editable in /admin/login) and arrive as a
 * prop: this stays a dumb, client-side slideshow.
 */
export function LoginCarousel({ slides }: LoginCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // An admin can delete slides while someone has the page open; clamping keeps
  // the index inside the list instead of showing nothing.
  const index = slides.length > 0 ? activeIndex % slides.length : 0;
  const active = slides[index];

  useEffect(() => {
    // One slide does not rotate; a timer would only re-render for nothing.
    if (slides.length < 2) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % slides.length),
      AUTOPLAY_MS
    );
    // Depending on activeIndex restarts the countdown after a manual pick.
    return () => window.clearInterval(timer);
  }, [activeIndex, slides.length]);

  if (slides.length === 0) return <div className="h-full w-full bg-muted" />;

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted">
      {slides.map((slide, slideIndex) => (
        <Image
          key={slide.id}
          src={slide.imageUrl}
          alt=""
          aria-hidden="true"
          fill
          priority={slideIndex === 0}
          sizes="50vw"
          // Uploaded images live in our public bucket and have no fixed size;
          // the bundled ones are served from /public and do get optimised.
          unoptimized={slide.imageUrl.startsWith("http")}
          className={cn(
            "object-cover transition-opacity duration-700",
            slideIndex === index ? "opacity-100" : "opacity-0"
          )}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-8">
        {/* Design: 16px / weight 500 / #585858. Single line, no shadow.
            A slide with no caption shows the image alone. */}
        {active?.caption ? (
          <p className="max-w-full rounded-xl bg-background/95 px-10 py-2.5 text-center text-base font-medium whitespace-nowrap text-ink-700 backdrop-blur">
            {active.caption}
          </p>
        ) : null}

        <div className="flex items-center gap-1.5">
          {slides.length > 1
            ? slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveIndex(slideIndex)}
                  aria-label={es.login.goToSlide.replace("{n}", String(slideIndex + 1))}
                  aria-current={slideIndex === index || undefined}
                  className={cn(
                    "h-1.5 cursor-pointer rounded-full transition-all",
                    slideIndex === index
                      ? "w-8 bg-brand"
                      : "w-5 bg-background/70 hover:bg-background"
                  )}
                />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
