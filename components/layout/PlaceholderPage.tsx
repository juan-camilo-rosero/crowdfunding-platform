import { es } from "@/i18n";

/**
 * Placeholder for routes whose real screen is not built yet. It exists so every
 * sidebar tab is actually navigable instead of 404-ing. Replace each usage with
 * the real view as its sprint lands.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="flex flex-1 flex-col gap-2 p-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        {es.placeholder.notice}
      </p>
    </main>
  );
}
