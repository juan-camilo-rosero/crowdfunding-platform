"use client";

import { useState, type ReactNode } from "react";
import {
  BarChart2Icon,
  FileTextIcon,
  FolderIcon,
  InfoIcon,
  TrendingUpIcon,
} from "lucide-react";
import { es } from "@/i18n";
import { TabBar } from "@/components/ui/tab-bar";

export type ProjectTabId =
  | "resumen"
  | "avance"
  | "reportes"
  | "documentos"
  | "mi-inversion";

export type ProjectTabsProps = {
  /**
   * Panels to offer, in display order. Rendered on the SERVER and handed over
   * as elements, so this component never queries anything — which is what keeps
   * "Mi inversión" honest: the page decides whether that panel exists at all,
   * from the authenticated user's position. Nothing here can conjure a tab the
   * server did not send.
   */
  panels: { id: ProjectTabId; content: ReactNode }[];
};

/** Icons live in client-land so no component reference crosses the RSC edge. */
const TAB_ICONS: Record<ProjectTabId, ReactNode> = {
  resumen: <InfoIcon />,
  avance: <TrendingUpIcon />,
  reportes: <BarChart2Icon />,
  documentos: <FolderIcon />,
  "mi-inversion": <FileTextIcon />,
};

const TAB_LABELS: Record<ProjectTabId, string> = {
  resumen: es.projectDetail.tabs.summary,
  avance: es.projectDetail.tabs.progress,
  reportes: es.projectDetail.tabs.reports,
  documentos: es.projectDetail.tabs.documents,
  "mi-inversion": es.projectDetail.tabs.myInvestment,
};

/**
 * Tab bar plus the active panel of the project detail screen.
 *
 * Every panel's markup arrives already rendered; switching tabs only changes
 * which one is shown. The inactive ones stay mounted but hidden, so moving
 * between tabs costs nothing and the hero above never reflows.
 */
export function ProjectTabs({ panels }: ProjectTabsProps) {
  const [activeId, setActiveId] = useState<ProjectTabId>(
    panels[0]?.id ?? "resumen"
  );

  // A tab could disappear between renders (a position closes); falling back to
  // the first panel avoids showing nothing at all.
  const active = panels.some((panel) => panel.id === activeId)
    ? activeId
    : (panels[0]?.id ?? "resumen");

  return (
    <div className="flex flex-col gap-6">
      <TabBar
        ariaLabel={es.projectDetail.tabs.ariaLabel}
        items={panels.map((panel) => ({
          id: panel.id,
          label: TAB_LABELS[panel.id],
          icon: TAB_ICONS[panel.id],
        }))}
        activeId={active}
        onSelect={(id) => setActiveId(id as ProjectTabId)}
      />

      {panels.map((panel) => (
        <div
          key={panel.id}
          id={`panel-${panel.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${panel.id}`}
          hidden={panel.id !== active}
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
}
