"use client";

import { useMemo, useState } from "react";
import { BellIcon, SearchIcon, SendIcon, UsersIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  searchRecipients,
  type NotificationRecipient,
} from "@/lib/notifications/recipients";
import {
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  sendNotificationSchema,
} from "@/lib/notifications/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/layout/EmptyState";
import { sendNotification } from "./actions";

export type NotificationsComposerPanelProps = {
  recipients: NotificationRecipient[];
};

type Audience = "all" | "selected";

/** {n} placeholders are replaced here so the strings stay in i18n. */
function count(template: string, singular: string, n: number): string {
  return n === 1 ? singular : template.replace("{n}", String(n));
}

/**
 * The admin's composer: a title, a message, and who gets it.
 *
 * It does not show a history of what was sent. Every notification belongs to
 * the person who received it — "users read own notifications" — so a sent log
 * would mean widening that policy to let an admin read other people's feeds,
 * and this screen is not worth that.
 *
 * Sending is confirmed in a dialog because it is not undoable: the rows are
 * written, the webhook fires, and the phones buzz. The dialog repeats the exact
 * text and the number of people, which is what an admin actually needs to check
 * before a message leaves.
 */
export function NotificationsComposerPanel({
  recipients,
}: NotificationsComposerPanelProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () => searchRecipients(recipients, query),
    [recipients, query]
  );

  const recipientCount = audience === "all" ? recipients.length : selected.size;

  // The same schema the Server Action runs. Checking it here only decides
  // whether the button is live; the action never trusts this result.
  const isValid = sendNotificationSchema.safeParse({
    title,
    body,
    audience,
    userIds: [...selected],
  }).success;

  function toggle(userId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  /** Acts on what the search is showing, not on the whole list. */
  function selectVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const recipient of visible) next.add(recipient.userId);
      return next;
    });
  }

  async function handleSend() {
    setIsSubmitting(true);
    setError(null);

    const result = await sendNotification({
      title,
      body,
      audience,
      userIds: [...selected],
    });

    setIsSubmitting(false);

    if (!result.ok) {
      // The dialog stays open with the reason.
      setError(result.error);
      return;
    }

    setNotice(
      count(
        es.adminNotifications.success,
        es.adminNotifications.successOne,
        result.count
      )
    );
    setIsConfirming(false);
    // A sent message is gone; leaving it in the fields invites sending it twice.
    setTitle("");
    setBody("");
    setSelected(new Set());
    setQuery("");
  }

  if (recipients.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon />}
        title={es.adminNotifications.empty}
        hint={es.adminNotifications.emptyHint}
        action={{ href: "/admin/usuarios", label: es.nav.users }}
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {notice ? (
        <p
          role="status"
          className="rounded-[10px] border border-line bg-elevated px-4 py-3 text-sm text-ink-700"
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-900">
          {es.adminNotifications.titleLabel}
          <Input
            inputSize="xl"
            value={title}
            maxLength={NOTIFICATION_TITLE_MAX}
            placeholder={es.adminNotifications.titlePlaceholder}
            onChange={(event) => setTitle(event.target.value)}
          />
          <span className="text-xs font-normal text-ink-400">
            {es.adminNotifications.charactersLeft.replace(
              "{n}",
              String(NOTIFICATION_TITLE_MAX - title.length)
            )}
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-900">
          {es.adminNotifications.bodyLabel}
          <Textarea
            value={body}
            rows={3}
            maxLength={NOTIFICATION_BODY_MAX}
            placeholder={es.adminNotifications.bodyPlaceholder}
            onChange={(event) => setBody(event.target.value)}
          />
          <span className="text-xs font-normal text-ink-400">
            {es.adminNotifications.charactersLeft.replace(
              "{n}",
              String(NOTIFICATION_BODY_MAX - body.length)
            )}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-ink-900">
          {es.adminNotifications.audienceLabel}
        </p>

        {/* Two mutually exclusive choices. `aria-pressed` is what tells a
            screen reader which one is active, since the styling cannot. */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={audience === "all" ? "brand" : "outline"}
            aria-pressed={audience === "all"}
            onClick={() => setAudience("all")}
          >
            <UsersIcon data-icon="inline-start" aria-hidden="true" />
            {es.adminNotifications.audienceAll}
          </Button>
          <Button
            type="button"
            variant={audience === "selected" ? "brand" : "outline"}
            aria-pressed={audience === "selected"}
            onClick={() => setAudience("selected")}
          >
            {es.adminNotifications.audienceSelected}
          </Button>
        </div>

        {audience === "all" ? (
          <p className="text-sm text-ink-500">
            {count(
              es.adminNotifications.audienceAllCount,
              es.adminNotifications.audienceAllCountOne,
              recipients.length
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="search"
                icon={<SearchIcon />}
                className="max-w-sm rounded-[5px]"
                placeholder={es.adminNotifications.searchPlaceholder}
                aria-label={es.adminNotifications.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectVisible}
              >
                {es.adminNotifications.selectAll}
              </Button>
              {selected.size > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  {es.adminNotifications.clearSelection}
                </Button>
              ) : null}
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={<SearchIcon />}
                title={es.adminNotifications.emptySearch}
                hint={es.adminNotifications.emptySearchHint}
              />
            ) : (
              <ul className="max-h-80 overflow-y-auto rounded-[10px] border border-line">
                {visible.map((recipient) => (
                  <li
                    key={recipient.userId}
                    className="border-b border-line last:border-b-0"
                  >
                    {/* The whole row is the label, so the click target is the
                        row and not just the 18px box. */}
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-elevated">
                      <Checkbox
                        checked={selected.has(recipient.userId)}
                        onCheckedChange={() => toggle(recipient.userId)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-ink-900">
                          {recipient.fullName ?? es.adminNotifications.noName}
                        </span>
                        {recipient.email ? (
                          <span className="truncate text-xs text-ink-500">
                            {recipient.email}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <p aria-live="polite" className="text-sm text-ink-500">
              {count(
                es.adminNotifications.selectedCount,
                es.adminNotifications.selectedCountOne,
                selected.size
              )}
            </p>
          </div>
        )}
      </div>

      <div>
        <Button
          type="button"
          variant="brand"
          size="xl"
          disabled={!isValid}
          onClick={() => {
            setError(null);
            setNotice(null);
            setIsConfirming(true);
          }}
        >
          <SendIcon data-icon="inline-start" aria-hidden="true" />
          {es.adminNotifications.send}
        </Button>
      </div>

      <FormDialog
        open={isConfirming}
        onOpenChange={(open) => {
          if (!open) setIsConfirming(false);
        }}
        title={es.adminNotifications.confirmTitle}
        description={es.adminNotifications.confirmDescription}
        onSubmit={handleSend}
        submitLabel={es.adminNotifications.send}
        submittingLabel={es.adminNotifications.sending}
        isSubmitting={isSubmitting}
        error={error}
      >
        <div className="flex flex-col gap-3">
          {/* The message exactly as it will arrive. */}
          <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-elevated px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
              <BellIcon className="size-4 shrink-0" aria-hidden="true" />
              {title}
            </p>
            <p className="text-sm whitespace-pre-line text-ink-700">{body}</p>
          </div>

          <p className="text-sm text-ink-500">
            {count(
              es.adminNotifications.confirmRecipients,
              es.adminNotifications.confirmRecipientsOne,
              recipientCount
            )}
          </p>
        </div>
      </FormDialog>
    </div>
  );
}
