"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Layout pieces shared by the volunteer-facing forms.

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

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

// An optional choice from a short list, as a themed select.
export function ChoiceField({
  field,
  label,
  options,
  placeholder,
  defaultValue,
  error,
}: {
  field: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder: string;
  defaultValue: string | null;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={field} error={error} optional>
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
