"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityIcon, SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import {
  matchesFilter,
  notConvertibleReason,
  type DirectoryFilter,
  type UserDirectoryEntry,
} from "@/lib/users/convertible";
import { searchUsers } from "@/lib/users/query";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/layout/EmptyState";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { ReadOnlyDataTable } from "@/components/tables/ReadOnlyDataTable";
import { convertVisitorToInvestor } from "./actions";

export type UsersDirectoryPanelProps = {
  users: UserDirectoryEntry[];
};

const COLUMNS: TableColumn[] = [
  { key: "fullName", label: es.adminUsers.columns.name, type: "text", width: 240 },
  { key: "email", label: es.adminUsers.columns.email, type: "email", width: 240 },
  { key: "state", label: es.adminUsers.columns.state, type: "select", width: 210 },
  { key: "createdAt", label: es.adminUsers.columns.registered, type: "date" },
  { key: "action", label: es.adminUsers.columns.action, type: "action", width: 230 },
];

const FILTER_OPTIONS: { value: DirectoryFilter; label: string }[] = [
  { value: "visitante", label: es.adminUsers.filter.visitor },
  { value: "inversionista", label: es.adminUsers.filter.investor },
  { value: "admin", label: es.adminUsers.filter.admin },
];

/**
 * The admin's user directory, and the place a visitor becomes an investor.
 *
 * It lists EVERYONE rather than only the people pending conversion. That is the
 * difference that makes it usable at scale: an admin can see where any person
 * stands, and a conversion visibly changes a row instead of making it vanish.
 *
 * Search and the state filter are client-side. This is a queue an admin works
 * through, bounded by "people who have signed up", so filtering in memory
 * avoids a round trip per keystroke. If the list ever stops being scannable it
 * moves to the URL like the catalogue's filters.
 */
export function UsersDirectoryPanel({ users }: UsersDirectoryPanelProps) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("todos");
  const [target, setTarget] = useState<UserDirectoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () => searchUsers(users, query).filter((user) => matchesFilter(user, filter)),
    [users, query, filter]
  );

  const isNarrowed = query.trim().length > 0 || filter !== "todos";

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
    // the row now reads "Inversionista" instead of disappearing.
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
        <div className="flex flex-wrap items-center gap-2">
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

          <FilterDropdown
            icon={<ActivityIcon />}
            ariaLabel={es.adminUsers.filter.label}
            placeholder={es.adminUsers.filter.label}
            clearLabel={es.adminUsers.filter.all}
            options={FILTER_OPTIONS}
            value={filter === "todos" ? null : filter}
            onSelect={(value) => setFilter((value as DirectoryFilter) ?? "todos")}
          />
        </div>

        <p aria-live="polite" className="text-sm text-ink-500">
          {countLabel}
        </p>
      </div>

      <ReadOnlyDataTable
        caption={es.adminUsers.tableCaption}
        columns={COLUMNS}
        rows={visible as unknown as TableRow[]}
        renderCell={(row, column) => {
          const user = row as unknown as UserDirectoryEntry;

          if (column.key === "fullName") {
            return (
              <span className={user.fullName ? "" : "text-ink-400"}>
                {user.fullName ?? es.adminUsers.noName}
              </span>
            );
          }

          if (column.key === "state") {
            return (
              <span className="flex flex-wrap items-center gap-1.5">
                {/* Both capabilities can be true at once — the owner runs the
                    business and has also invested — so this renders badges
                    rather than picking one label. */}
                {user.isAdmin ? (
                  <Badge variant="neutral">{es.adminUsers.state.admin}</Badge>
                ) : null}
                {user.isInvestor ? (
                  <Badge variant="success">{es.adminUsers.state.investor}</Badge>
                ) : null}
                {!user.isAdmin && !user.isInvestor ? (
                  <Badge variant="warning">{es.adminUsers.state.visitor}</Badge>
                ) : null}
                {/* Tells the admin this will CONNECT, not create. */}
                {user.hasMatchingProspect && user.canConvert ? (
                  <Badge variant="neutral">{es.adminUsers.hasProspect}</Badge>
                ) : null}
              </span>
            );
          }

          if (column.key === "createdAt") {
            return user.createdAt ? formatDate(user.createdAt) : "";
          }

          if (column.key === "action") {
            const reason = notConvertibleReason(user);
            // A reason instead of a dead button: the row says why, and the
            // condition is the same one the Server Action enforces.
            if (reason) {
              return (
                <span className="text-sm text-ink-400">
                  {es.adminUsers.cannotConvert[reason]}
                </span>
              );
            }

            return (
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setTarget(user);
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
          isNarrowed ? (
            <EmptyState
              icon={<SearchIcon />}
              title={es.adminUsers.emptySearch}
              hint={es.adminUsers.emptySearchHint}
            />
          ) : (
            <EmptyState
              icon={<UsersIcon />}
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
