import { es } from "@/i18n";
import {
  DEFAULT_LOGIN_SLIDES,
  fetchLoginSlides,
  type LoginSlide,
} from "@/lib/site/login-slides";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/layout/PageTitle";
import { LoginSlidesPanel } from "./LoginSlidesPanel";

/**
 * The login screen's carousel.
 *
 * ACCESS: proxy.ts restricts /admin/* to role = 'admin', and every write runs
 * under the admin's own session, where login_slides_admin_write re-checks it
 * inside the database.
 *
 * The page shows exactly what the login shows — including the bundled images
 * when nothing is configured yet — so what the admin edits is never a
 * different list from what visitors see.
 */
export default async function AdminLoginSlidesPage() {
  const supabase = await createClient();
  const slides = await fetchLoginSlides(supabase);

  // fetchLoginSlides falls back to the bundled images; the panel has to know
  // which of the two it is holding, because those cannot be reordered.
  const usingDefaults = isDefaultSet(slides);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.adminLogin.title}</PageTitle>
        <p className="max-w-2xl text-base text-ink-500">{es.adminLogin.subtitle}</p>
      </div>

      <LoginSlidesPanel slides={slides} usingDefaults={usingDefaults} />
    </div>
  );
}

function isDefaultSet(slides: LoginSlide[]): boolean {
  return (
    slides.length === DEFAULT_LOGIN_SLIDES.length &&
    slides.every((slide, index) => slide.id === DEFAULT_LOGIN_SLIDES[index].id)
  );
}
