"use client";

import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { ChoiceField, Field, Section } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Sex, TShirtSize } from "@/generated/prisma/enums";
import type { ProfileField } from "@/lib/profile";
import { SEX_OPTIONS, T_SHIRT_SIZES } from "@/lib/volunteers";

// A volunteer's saved details, formatted for these fields.
export type ProfileDefaults = {
  firstName: string;
  lastName: string;
  phone: string; // "(765) 555-0123"
  smsOptIn: boolean;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  dateOfBirth: string; // "1990-05-17"
  sex: Sex | null;
  tShirtSize: TShirtSize | null;
};

// The "Your information" and "Emergency contact" sections, used by the
// signup form and the profile page. The server checks them with
// profileSchema (src/lib/profile.ts).
export function ProfileFields({
  errors,
  defaults,
  description,
}: {
  errors: Partial<Record<ProfileField, string>>;
  defaults: ProfileDefaults | null;
  description?: string;
}) {
  const [smsOptIn, setSmsOptIn] = useState(defaults?.smsOptIn ?? false);

  const text = (
    field: Exclude<ProfileField, "smsOptIn" | "dateOfBirth" | "sex" | "tShirtSize">,
    label: string,
    props: React.ComponentProps<"input"> = {},
  ) => (
    <Field label={label} htmlFor={field} error={errors[field]}>
      <Input
        id={field}
        name={field}
        defaultValue={defaults?.[field] ?? ""}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${field}-error` : undefined}
        required
        {...props}
      />
    </Field>
  );

  return (
    <>
      <Section title="Your information" description={description}>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("firstName", "First name", { autoComplete: "given-name" })}
          {text("lastName", "Last name", { autoComplete: "family-name" })}
          {text("phone", "Phone", { type: "tel", autoComplete: "tel", placeholder: "(765) 555-0123" })}
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <Checkbox
              checked={smsOptIn}
              onCheckedChange={setSmsOptIn}
              className="mt-0.5"
            />
            <span>
              Text me reminders and updates about my shifts, including on
              build days.{" "}
              <span className="text-muted-foreground">
                Message and data rates may apply. Reply STOP to opt out.
              </span>
            </span>
          </label>
          {smsOptIn && <input type="hidden" name="smsOptIn" value="on" />}
          <div className="sm:col-span-2">
            {text("address", "Home address", {
              autoComplete: "street-address",
              placeholder: "123 Main St, Lafayette, IN 47901",
            })}
          </div>
          <Field label="Birthday" htmlFor="dateOfBirth" error={errors.dateOfBirth}>
            <DatePicker
              id="dateOfBirth"
              name="dateOfBirth"
              defaultValue={defaults?.dateOfBirth}
              placeholder="Pick your birthday"
              birthday
              aria-invalid={errors.dateOfBirth ? true : undefined}
              aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined}
            />
          </Field>
          <div className="hidden sm:block" />
          <ChoiceField
            field="sex"
            label="Sex"
            options={SEX_OPTIONS}
            placeholder="Prefer not to say"
            defaultValue={defaults?.sex ?? null}
            error={errors.sex}
          />
          <ChoiceField
            field="tShirtSize"
            label="T-shirt size"
            options={T_SHIRT_SIZES}
            placeholder="Choose a size"
            defaultValue={defaults?.tShirtSize ?? null}
            error={errors.tShirtSize}
          />
        </div>
      </Section>

      <Section title="Emergency contact">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("emergencyContactName", "Name", { autoComplete: "off" })}
          {text("emergencyContactPhone", "Phone", { type: "tel", autoComplete: "off" })}
        </div>
      </Section>
    </>
  );
}
