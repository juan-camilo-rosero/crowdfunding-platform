"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, UserPlusIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { ConvertibleUser } from "@/lib/users/convertible";
import { searchConvertibleUsers } from "@/lib/users/query";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/layout/EmptyState";
import { ReadOnlyDataTable } from "@/components/tables/ReadOnlyDataTable";
import { convertVisitorToInvestor } from "./actions";

export type ConvertibleUsersPanelProps = {
  users: ConvertibleUser[];
};

const COLUMNS: TableColumn[] = [
  { key: "fullName", label: es.adminUsers.columns.name, type: "text", width: 260 },
  { key: "email", label: es.adminUsers.columns.email, type: "email", width: 260 },
  { key: "createdAt", label: es.adminUsers.columns.registered, type: "date" },
  { key: "action", label: es.adminUsers.columns.action, type: "action", width: 230 },
];

/**
 * The linking funnel: users waiting to be turned into investors.
 *
 * Search is client-side on purpose. The list is bounded by "people who signed
 * up and have not been linked yet" — a queue an admin is expected to drain, not
 * a growing archive — so filtering in memory avoids a round trip per keystroke.
 * If it ever stops being a queue, this moves to the URL like the other filters.
 */
export function ConvertibleUsersPanel({ users }: ConvertibleUsersPanelProps) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ConvertibleUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () => searchConvertibleUsers(users, query),
    [users, query]
  );

  const countLabel =
    visible.length === 1
      ? es.adminUsers.resultsCountOne
      : es.adminUsers.resultsCount.replace("{n}", String(visible.length));

  async function handleConvert() {
    if (!target) return;

    setIsSubmitting(true);
    setError(null);

    const result = await convertVisitorToInvestor({ userId: target.id });

    setIsSubmitting(false);

    if (!result.ok) {
      // The dialog stays open with the reason.
      setError(result.error);
      return;
    }

    setNotice(
      result.outcome === "connected"
        ? es.adminUsers.successConnected
        : es.adminUsers.successCreated
    );
    setTarget(null);
    // revalidatePath already refreshed the server data; this re-renders it, so
    // the converted person drops off the list.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {notice ? (
        <p
          role="status"
          className="rounded-[10px] border border-line bg-elevated px-4 py-3 text-sm text-ink-700"
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Input
          type="search"
          inputSize="xl"
          icon={<SearchIcon />}
          className="max-w-sm rounded-[5px]"
          placeholder={es.adminUsers.searchPlaceholder}
          aria-label={es.adminUsers.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p aria-live="polite" className="text-sm text-ink-500">
          {countLabel}
        </p>
      </div>

      <ReadOnlyDataTable
        caption={es.adminUsers.tableCaption}
        columns={COLUMNS}
        rows={visible as unknown as TableRow[]}
        renderCell={(row, column) => {
          if (column.key === "fullName") {
            const name = row.fullName ? String(row.fullName) : null;
            return (
              <span className="flex flex-wrap items-center gap-2">
                <span className={name ? "" : "text-ink-400"}>
                  {name ?? es.adminUsers.noName}
                </span>
                {/* Tells the admin this will CONNECT, not create. */}
                {row.hasMatchingProspect ? (
                  <Badge variant="warning">{es.adminUsers.hasProspect}</Badge>
                ) : null}
              </span>
            );
          }
          if (column.key === "createdAt") {
            return row.createdAt ? formatDate(String(row.createdAt)) : "";
          }
          if (column.key === "action") {
            return (
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setTarget(row as unknown as ConvertibleUser);
                }}
              >
                <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
                {es.adminUsers.convert}
              </Button>
            );
          }
          return undefined;
        }}
        emptyState={
          query.trim() ? (
            <EmptyState
              icon={<SearchIcon />}
              title={es.adminUsers.emptySearch}
              hint={es.adminUsers.emptySearchHint}
            />
          ) : (
            <EmptyState
              icon={<UserPlusIcon />}
              title={es.adminUsers.empty}
              hint={es.adminUsers.emptyHint}
            />
          )
        }
      />

      <FormDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={es.adminUsers.confirmTitle}
        description={es.adminUsers.confirmDescription}
        onSubmit={handleConvert}
        submitLabel={es.adminUsers.convert}
        submittingLabel={es.adminUsers.converting}
        isSubmitting={isSubmitting}
        error={error}
      >
        {target ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink-900">
              {es.adminUsers.confirmPerson
                .replace("{name}", target.fullName ?? es.adminUsers.noName)
                .replace("{email}", target.email)}
            </p>
            <p className="text-sm text-ink-500">
              {target.hasMatchingProspect
                ? es.adminUsers.confirmWithProspect
                : es.adminUsers.confirmWithoutProspect}
            </p>
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
