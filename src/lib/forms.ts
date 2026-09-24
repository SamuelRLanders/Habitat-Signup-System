import * as z from "zod";

// Helpers for Server Actions that handle form submissions.

export type FormState<Field extends string> = {
  errors?: Partial<Record<Field | "form", string>>;
  success?: boolean;
};

// The first error message for each field, plus any form-wide one as "form".
export function firstErrors(error: z.ZodError) {
  const { fieldErrors, formErrors } = z.flattenError(error);
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (Array.isArray(messages) && messages[0]) errors[field] = messages[0];
  }
  if (formErrors[0]) errors.form = formErrors[0];
  return errors;
}

// The submitted text fields, without React's internal "$ACTION_…" fields.
// A field sent more than once keeps its last value.
export function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}
