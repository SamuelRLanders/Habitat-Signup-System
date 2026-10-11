// A field's error message, linked to the field by aria-describedby
// ("<field>-error").
export function FieldError({ field, error }: { field: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${field}-error`} className="text-sm text-destructive">
      {error}
    </p>
  );
}
