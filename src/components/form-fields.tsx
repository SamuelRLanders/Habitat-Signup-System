"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Fields shared by the volunteer-facing forms.

// A label, the control, and a hint or error below. The error's id is
// "<htmlFor>-error", for the control's aria-describedby.
export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// A choice from a short list, as a themed select. Optional unless said.
export function ChoiceField({
  field,
  label,
  options,
  placeholder,
  defaultValue,
  error,
  optional = true,
}: {
  field: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder: string;
  defaultValue: string | null;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field label={label} htmlFor={field} error={error} optional={optional}>
      <Select name={field} items={options} defaultValue={defaultValue}>
        <SelectTrigger
          id={field}
          aria-invalid={error ? true : undefined}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// A required yes or no, as a pair of pills. Sends "yes" or "no".
export function YesNoField({
  field,
  label,
  hint,
  defaultValue,
  error,
  onChange,
}: {
  field: string;
  label: string;
  hint?: string;
  defaultValue: boolean | null;
  error?: string;
  onChange?: (value: boolean) => void;
}) {
  const [value, setValue] = useState(
    defaultValue === null ? null : defaultValue ? "yes" : "no",
  );
  const describedBy = [hint && `${field}-hint`, error && `${field}-error`]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${field}-label`}
      aria-describedby={describedBy || undefined}
      aria-invalid={error ? true : undefined}
      // Lets the form move focus here after a failed submission.
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none"
    >
      <span id={`${field}-label`} className="text-sm font-medium">
        {label}
      </span>
      {hint && (
        <p id={`${field}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="flex w-fit gap-1 rounded-full bg-muted p-1">
        {(
          [
            ["yes", "Yes"],
            ["no", "No"],
          ] as const
        ).map(([option, optionLabel]) => (
          <label
            key={option}
            className="cursor-pointer hover-gold rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={field}
              value={option}
              checked={value === option}
              onChange={() => {
                setValue(option);
                onChange?.(option === "yes");
              }}
              className="sr-only"
            />
            {optionLabel}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${field}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
