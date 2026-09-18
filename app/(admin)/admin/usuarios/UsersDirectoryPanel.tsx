"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityIcon, FileSignatureIcon, SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react";
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
import { TableCellStack } from "@/components/tables/TableCellStack";
import { convertVisitorToInvestor } from "./actions";
import { sendContractForSignature } from "./contract-actions";

export type UsersDirectoryPanelProps = {
  users: UserDirectoryEntry[];
};

/**
 * The person is ONE column of two lines — name, and the email beneath it.
 *
 * They were two columns, which spent the table's width saying one thing: who
 * this is. The email is also what tells apart two people with the same name
 * (it is the identity the whole linking flow relies on), so it belongs right
 * under the name rather than a column away. The width it frees goes to the
 * state badges and the action, which were the ones wrapping.
 */
const COLUMNS: TableColumn[] = [
  { key: "fullName", label: es.adminUsers.columns.user, type: "text", width: 300 },
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

  /** The investor whose contract is being sent, and the chosen PDF. */
  const [contractTarget, setContractTarget] = useState<UserDirectoryEntry | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [isSendingContract, setIsSendingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  async function handleSendContract() {
    if (!contractTarget || !contractFile) return;

    setIsSendingContract(true);
    setContractError(null);

    // FormData, not JSON: the PDF goes straight through to the provider and is
    // never parked in storage.
    const payload = new FormData();
    payload.set("userId", contractTarget.id);
    payload.set("contract", contractFile);

    const result = await sendContractForSignature(payload);
    setIsSendingContract(false);

    if (!result.ok) {
      setContractError(result.error);
      return;
    }

    setNotice(es.adminContract.sent);
    setContractTarget(null);
    setContractFile(null);
    router.refresh();
  }

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
            className="max-w-sm rounded-[10px]"
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

          {/* The count sits at the end of the same row, where the eye already
              is after the filters — not on a line of its own under them. */}
          <p aria-live="polite" className="ml-auto text-sm text-ink-500">
            {countLabel}
          </p>
        </div>
      </div>

      <ReadOnlyDataTable
        caption={es.adminUsers.tableCaption}
        columns={COLUMNS}
        rows={visible as unknown as TableRow[]}
        // A directory is scanned by name: it leads the row.
        emphasizeColumn="fullName"
        renderCell={(row, column) => {
          const user = row as unknown as UserDirectoryEntry;

          if (column.key === "fullName") {
            const name = user.fullName?.trim();
            return (
              <TableCellStack
                // No name yet (onboarding not finished): say so in the muted
                // ink, so it never reads as though that were their name.
                primary={name || es.adminUsers.noName}
                primaryMuted={!name}
                secondary={user.email}
              />
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

            // Already an investor: the useful action here is not converting
            // them again but sending the contract they have to sign.
            if (user.isInvestor) {
              return (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContractError(null);
                    setNotice(null);
                    setContractFile(null);
                    setContractTarget(user);
                  }}
                >
                  <FileSignatureIcon data-icon="inline-start" aria-hidden="true" />
                  {es.adminContract.send}
                </Button>
              );
            }

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

      <FormDialog
        open={contractTarget !== null}
        onOpenChange={(open) => {
          if (!open) setContractTarget(null);
        }}
        title={es.adminContract.dialogTitle}
        description={es.adminContract.dialogDescription}
        onSubmit={handleSendContract}
        submitLabel={es.adminContract.send}
        submittingLabel={es.adminContract.sending}
        isSubmitting={isSendingContract}
        submitDisabled={!contractFile}
        error={contractError}
      >
        {contractTarget ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-ink-900">
              {es.adminUsers.confirmPerson
                .replace("{name}", contractTarget.fullName ?? es.adminUsers.noName)
                .replace("{email}", contractTarget.email)}
            </p>

            <label className="flex flex-col gap-1.5 text-sm text-ink-700">
              {es.adminContract.fileLabel}
              <Input
                type="file"
                accept="application/pdf"
                aria-label={es.adminContract.fileLabel}
                onChange={(event) =>
                  setContractFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
