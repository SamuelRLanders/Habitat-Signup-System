// Pieces of the People and Builds tabs' Filters dialogs. No hooks, so the
// client search bars can use them.

export function Group({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}

// A checkbox or radio button drawn as a pill that fills in when chosen.
export function Pill({
  type,
  name,
  value,
  label,
  defaultChecked,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex h-7 items-center hover-gold rounded-full border border-border px-3 text-[0.8rem] font-medium transition-colors select-none hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:hover:bg-primary/80 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
        {label}
      </span>
    </label>
  );
}
