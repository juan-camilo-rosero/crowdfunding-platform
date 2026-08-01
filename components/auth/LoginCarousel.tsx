"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";

/** Time each slide stays on screen before advancing on its own. */
const AUTOPLAY_MS = 10_000;

/** Slide images, in the same order as `es.login.carouselSlides` captions. */
const SLIDES = [
  "/carousel/login_carousel_1.jpg",
  "/carousel/login_carousel_2.jpg",
  "/carousel/login_carousel_3.jpg",
  "/carousel/login_carousel_4.jpg",
];

/**
 * Decorative panel on the right half of the login screen. Advances on its own
 * every 10s and on dot click; a manual pick restarts the timer so the slide the
 * user chose gets its full turn.
 *
 * Hidden on mobile by the page layout: the small screen keeps only the form.
 */
export function LoginCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % SLIDES.length),
      AUTOPLAY_MS
    );
    // Depending on activeIndex restarts the countdown after a manual pick.
    return () => window.clearInterval(timer);
  }, [activeIndex]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted">
      {SLIDES.map((src, index) => (
        <Image
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          fill
          priority={index === 0}
          sizes="50vw"
          className={cn(
            "object-cover transition-opacity duration-700",
            index === activeIndex ? "opacity-100" : "opacity-0"
          )}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-8">
        {/* Design: 16px / weight 500 / #585858. Single line, no shadow. */}
        <p className="max-w-full rounded-xl bg-background/95 px-10 py-2.5 text-center text-base font-medium whitespace-nowrap text-ink-700 backdrop-blur">
          {es.login.carouselSlides[activeIndex]}
        </p>

        <div className="flex items-center gap-1.5">
          {SLIDES.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={es.login.goToSlide.replace("{n}", String(index + 1))}
              aria-current={index === activeIndex || undefined}
              className={cn(
                "h-1.5 cursor-pointer rounded-full transition-all",
                index === activeIndex
                  ? "w-8 bg-brand"
                  : "w-5 bg-background/70 hover:bg-background"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
