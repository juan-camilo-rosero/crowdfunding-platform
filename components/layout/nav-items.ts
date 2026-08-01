import {
  CreditCardIcon,
  DatabaseIcon,
  FileTextIcon,
  FilterIcon,
  FolderIcon,
  HomeIcon,
  InboxIcon,
  LayoutGridIcon,
  type LucideIcon,
} from "lucide-react";
import { es } from "@/i18n";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Navigation is shared by the desktop sidebar and the mobile bottom nav, so the
 * item lists live here and neither component owns them.
 *
 * Icons come from lucide-react, the maintained fork of Feather Icons used in
 * the Figma file — same shapes and stroke language.
 */

/** Requires the investor capability (a linked row in `investors`). */
export const INVESTOR_NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: es.nav.home, icon: HomeIcon },
  { href: "/mis-inversiones", label: es.nav.myInvestments, icon: LayoutGridIcon },
  { href: "/transacciones", label: es.nav.transactions, icon: CreditCardIcon },
  { href: "/documentos", label: es.nav.documents, icon: FileTextIcon },
  { href: "/solicitudes", label: es.nav.requests, icon: InboxIcon },
];

/** Open to every onboarded user, with or without capabilities. */
export const CATALOG_NAV_ITEM: NavItem = {
  href: "/portafolio",
  label: es.nav.catalog,
  icon: FolderIcon,
};

/**
 * "Admin" group. Requires users.role = 'admin'.
 *
 * Only these two entries live in the sidebar; the rest of the admin screens
 * (proyectos, capital, usuarios, aprobaciones…) are reached from inside the
 * admin panel, not from here.
 */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: es.nav.adminPanel, icon: DatabaseIcon },
  { href: "/admin/pipeline", label: es.nav.salesFunnel, icon: FilterIcon },
];
