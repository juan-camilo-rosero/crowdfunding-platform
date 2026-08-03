"use client";

import { useState, type FormEvent } from "react";
import { DollarSignIcon, MessageSquareIcon } from "lucide-react";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type InterestFormProps = {
  /** The project this interest would be about. Not sent anywhere yet. */
  projectId: string;
  className?: string;
};

/**
 * "Me interesa este proyecto" — VISUAL MOCK.
 *
 * TODO(sprint de captación): wire the submit to a Server Action that inserts
 * into `investment_interests` (the table already exists: user_id, project_id,
 * amount, investment_type_pref, comments, phone, status). It must validate with
 * Zod on the server and take user_id from the session, never from the client —
 * interests_insert_own only accepts rows where user_id = auth.uid(). The
 * "investment type" and "phone if missing from the profile" fields described in
 * views.md belong to that sprint too; this mock covers only the two fields in
 * the design.
 *
 * Until then `handleSubmit` writes NOTHING. It is deliberately inert rather
 * than optimistic: showing a success message for a request that never happened
 * would be a lie to someone trying to invest.
 */
export function InterestForm({ projectId, className }: InterestFormProps) {
  const [amount, setAmount] = useState("");
  const [comments, setComments] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: replace with the Server Action described above. Referencing the
    // values here keeps the fields wired to the shape the action will receive.
    void { projectId, amount, comments };
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-4 rounded-[10px] border border-neutral-200 bg-stone-50 p-6",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-medium text-stone-900">
          {es.projectDetail.interest.title}
        </h2>
        <p className="text-sm text-zinc-600">
          {es.projectDetail.interest.subtitle}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-600">
          {es.projectDetail.interest.amountLabel}
        </span>
        <Input
          inputSize="xl"
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={es.projectDetail.interest.amountPlaceholder}
          icon={<DollarSignIcon />}
          className="rounded-[5px]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-600">
          {es.projectDetail.interest.commentsLabel}
        </span>
        <Input
          inputSize="xl"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder={es.projectDetail.interest.commentsPlaceholder}
          icon={<MessageSquareIcon />}
          className="rounded-[5px]"
        />
      </label>

      <Button
        type="submit"
        size="xl"
        className="w-full rounded-[10px] bg-stone-900 text-stone-50 hover:bg-stone-900/90"
      >
        {es.projectDetail.interest.submit}
      </Button>

      <p className="text-xs text-neutral-400">
        {es.projectDetail.interest.disclaimer}
      </p>
    </form>
  );
}
