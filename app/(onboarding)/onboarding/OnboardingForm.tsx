"use client";

import { useActionState, useRef, useState } from "react";
import { IdCardIcon, UserIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  onboardingSchema,
  type OnboardingErrors,
} from "@/lib/onboarding/schema";
import { DEFAULT_COUNTRY } from "@/lib/onboarding/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CityAutocomplete } from "@/components/auth/CityAutocomplete";
import { FormField } from "@/components/auth/FormField";
import { PhoneField } from "@/components/auth/PhoneField";
import { saveBasicOnboarding, type OnboardingState } from "./actions";

type FieldName = keyof OnboardingErrors;

/**
 * Defined here, not in actions.ts: a "use server" module may only export async
 * functions, so a constant exported from there arrives as `undefined`.
 */
const EMPTY_STATE: OnboardingState = { error: null, fieldErrors: {} };

/**
 * Basic onboarding form.
 *
 * Validation runs on blur and on submit, never while typing — flagging a phone
 * number as too short at the second digit is noise, not help. The same Zod
 * schema runs again on the server, which is the one that decides (see
 * actions.ts); what happens here only saves the user a round trip.
 *
 * The city is the one field whose validity is not about its text: it counts
 * only when an option was picked from the autocomplete, which is what
 * `cityPlaceId` records.
 */
export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    saveBasicOnboarding,
    EMPTY_STATE
  );

  const formRef = useRef<HTMLFormElement>(null);

  const [fullName, setFullName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY.dial);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [cityPlaceId, setCityPlaceId] = useState("");
  const [country, setCountry] = useState("");

  const [clientErrors, setClientErrors] = useState<OnboardingErrors>({});

  const values = {
    fullName,
    documentId,
    phoneCountryCode,
    phoneNumber,
    city,
    cityPlaceId,
    country,
  };

  /** Validates ONE field and updates only its message. */
  function validateField(field: FieldName) {
    const result = onboardingSchema.safeParse(values);
    const issue = result.success
      ? undefined
      : result.error.issues.find((entry) => entry.path[0] === field);

    setClientErrors((previous) => ({
      ...previous,
      [field]: issue?.message,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = onboardingSchema.safeParse(values);
    if (result.success) return; // let the action run

    // Nothing is sent while a field is invalid; every message shows at once so
    // the user sees the full picture instead of fixing them one by one.
    event.preventDefault();
    const errors: OnboardingErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as FieldName | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    }
    setClientErrors(errors);
  }

  /** Server messages win: they are the authoritative run. */
  const errorFor = (field: FieldName) =>
    state.fieldErrors[field] ?? clientErrors[field];

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 flex flex-col gap-4"
    >
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <FormField
        label={es.onboarding.fullNameLabel}
        htmlFor="fullName"
        error={errorFor("fullName")}
      >
        <Input
          id="fullName"
          name="fullName"
          inputSize="xl"
          icon={<UserIcon />}
          autoComplete="name"
          className="rounded-[5px]"
          placeholder={es.onboarding.fullNamePlaceholder}
          value={fullName}
          disabled={pending}
          aria-invalid={!!errorFor("fullName") || undefined}
          aria-describedby={errorFor("fullName") ? "fullName-error" : undefined}
          onChange={(event) => setFullName(event.target.value)}
          onBlur={() => validateField("fullName")}
        />
      </FormField>

      <FormField
        label={es.onboarding.documentLabel}
        htmlFor="documentId"
        error={errorFor("documentId")}
      >
        <Input
          id="documentId"
          name="documentId"
          inputSize="xl"
          inputMode="numeric"
          icon={<IdCardIcon />}
          autoComplete="off"
          className="rounded-[5px]"
          placeholder={es.onboarding.documentPlaceholder}
          value={documentId}
          disabled={pending}
          aria-invalid={!!errorFor("documentId") || undefined}
          aria-describedby={
            errorFor("documentId") ? "documentId-error" : undefined
          }
          // Stripped on the way in: a pasted "1.020.345" becomes digits.
          onChange={(event) =>
            setDocumentId(event.target.value.replace(/\D/g, ""))
          }
          onBlur={() => validateField("documentId")}
        />
      </FormField>

      <FormField
        label={es.onboarding.phoneLabel}
        htmlFor="phoneNumber"
        error={errorFor("phoneNumber") ?? errorFor("phoneCountryCode")}
      >
        <PhoneField
          id="phoneNumber"
          countryCode={phoneCountryCode}
          onCountryCodeChange={setPhoneCountryCode}
          value={phoneNumber}
          onValueChange={setPhoneNumber}
          onBlur={() => validateField("phoneNumber")}
          invalid={!!errorFor("phoneNumber")}
          disabled={pending}
        />
        {/* The pair travels as two fields; the action joins them into E.164. */}
        <input type="hidden" name="phoneCountryCode" value={phoneCountryCode} />
        <input type="hidden" name="phoneNumber" value={phoneNumber} />
      </FormField>

      <FormField
        label={es.onboarding.cityLabel}
        htmlFor="city"
        error={errorFor("cityPlaceId") ?? errorFor("city")}
      >
        <CityAutocomplete
          id="city"
          value={city}
          // Typing after a pick invalidates it: the stored city must be the one
          // that was chosen, not whatever was left in the box afterwards.
          onValueChange={(value) => {
            setCity(value);
            setCityPlaceId("");
            setCountry("");
          }}
          onSelect={(selection) => {
            setCity(selection.city);
            setCityPlaceId(selection.placeId);
            setCountry(selection.country);
            setClientErrors((previous) => ({
              ...previous,
              city: undefined,
              cityPlaceId: undefined,
            }));
          }}
          onBlur={() => validateField("cityPlaceId")}
          invalid={!!(errorFor("cityPlaceId") ?? errorFor("city"))}
          disabled={pending}
        />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="cityPlaceId" value={cityPlaceId} />
        <input type="hidden" name="country" value={country} />
      </FormField>

      <Button
        type="submit"
        variant="brand"
        size="xl"
        fullWidth
        className="mt-2"
        loading={pending}
        loadingText={es.onboarding.saving}
      >
        {es.onboarding.submit}
      </Button>
    </form>
  );
}
