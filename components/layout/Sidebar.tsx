import Link from "next/link";
import { es } from "@/i18n";
import { getCapabilities } from "@/lib/auth/session";

/**
 * Navigation built from CAPABILITIES, not from a single role: the investor
 * section shows when the user has a link in `investors`, the admin section when
 * users.role = 'admin'. The owner (both) sees both sections.
 *
 * Structural only — visual design comes in the design phase.
 */
const INVESTOR_LINKS = [
  { href: "/inicio", label: es.nav.home },
  { href: "/mis-inversiones", label: es.nav.myInvestments },
  { href: "/transacciones", label: es.nav.transactions },
  { href: "/documentos", label: es.nav.documents },
  { href: "/solicitudes", label: es.nav.requests },
];

const ADMIN_LINKS = [
  { href: "/admin", label: es.nav.adminHome },
  { href: "/admin/proyectos", label: es.nav.projects },
  { href: "/admin/inversionistas", label: es.nav.investors },
  { href: "/admin/capital", label: es.nav.capital },
  { href: "/admin/presupuesto", label: es.nav.budget },
  { href: "/admin/tareas", label: es.nav.tasks },
  { href: "/admin/reportes", label: es.nav.reports },
  { href: "/admin/documentos", label: es.nav.documents },
  { href: "/admin/usuarios", label: es.nav.users },
  { href: "/admin/pipeline", label: es.nav.pipeline },
  { href: "/admin/aprobaciones", label: es.nav.approvals },
];

// Always available to any onboarded user, with or without capabilities.
const COMMON_LINKS = [
  { href: "/portafolio", label: es.nav.catalog },
  { href: "/perfil", label: es.nav.profile },
];

function NavSection({
  title,
  links,
}: {
  title?: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {title ? (
        <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
          {title}
        </p>
      ) : null}
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export async function Sidebar() {
  const capabilities = await getCapabilities();
  if (!capabilities) return null;

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-3 dark:border-white/15">
      {capabilities.isInvestor ? (
        <NavSection title={es.nav.investorSection} links={INVESTOR_LINKS} />
      ) : null}

      <NavSection links={COMMON_LINKS} />

      {capabilities.isAdmin ? (
        <NavSection title={es.nav.adminSection} links={ADMIN_LINKS} />
      ) : null}
    </nav>
  );
}
