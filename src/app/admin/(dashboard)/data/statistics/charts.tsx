import { cn } from "cn";

// The Statistics tab's charts, drawn in HTML so they need no chart library
// or script: one color (--chart-bar) since each chart has one series, thin
// bars with rounded ends growing from one baseline, hairline gridlines, and
// a tooltip on hover or keyboard focus. Each chart can also be read as a
// table, so no value is only in a tooltip.

export type ChartRow = {
  key: string;
  // Under the column, or beside the bar.
  label: string;
  value: number;
  // In the tooltip and the table: "Age 19", "October 2026".
  name: string;
};

// Columns along a baseline, such as volunteers by age. tickEvery shows
// every nth label under the columns, for charts with many of them.
export function ColumnChart({
  title,
  rows,
  unit,
  tickEvery = 1,
}: {
  title: string;
  rows: ChartRow[];
  // What a value counts: (19) → "19 volunteers".
  unit: (value: number) => string;
  tickEvery?: number;
}) {
  const ticks = niceTicks(Math.max(0, ...rows.map((row) => row.value)));
  const top = ticks.at(-1)!;
  const tallest = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Value ticks. */}
        <div aria-hidden="true" className="relative h-48 w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
              {tick.toLocaleString("en-US")}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Gridlines, the one at 0 being the baseline. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48">
            {ticks.map((tick) => (
              <div
                key={tick}
                className={cn("absolute inset-x-0 h-px", tick === 0 ? "bg-foreground/25" : "bg-foreground/8")}
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}
          </div>
          <ul aria-label={title} className="relative flex h-48 items-end gap-0.5">
            {rows.map((row) => {
              const height = (row.value / top) * 100;
              return (
                <li
                  key={row.key}
                  tabIndex={0}
                  aria-label={`${row.name}: ${unit(row.value)}`}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {row.value > 0 && (
                    <div
                      className="w-full max-w-6 rounded-t-[4px] bg-chart-bar transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                      style={{ height: `${height}%` }}
                    />
                  )}
                  {/* The tallest column's value, on its cap. */}
                  {row === tallest && row.value > 0 && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute mb-1 text-xs font-medium tabular-nums group-hover:invisible group-focus-visible:invisible"
                      style={{ bottom: `${height}%` }}
                    >
                      {row.value.toLocaleString("en-US")}
                    </span>
                  )}
                  <Tooltip bottom={height}>
                    <span className="font-semibold tabular-nums">{unit(row.value)}</span>
                    <span className="text-muted-foreground">{row.name}</span>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          <div aria-hidden="true" className="mt-1.5 flex gap-0.5 text-xs text-muted-foreground">
            {rows.map((row, index) => (
              <span key={row.key} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
                {index % tickEvery === 0 ? row.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <TableView rows={rows} unit={unit} />
    </figure>
  );
}

// Bars across, one per category, each with its value at the tip, such as
// how volunteers got to the site.
export function BarList({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: ChartRow[];
  unit: (value: number) => string;
}) {
  const most = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <figure className="flex flex-col gap-2">
      <ul aria-label={title} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.key}
            tabIndex={0}
            aria-label={`${row.name}: ${unit(row.value)}${total ? `, ${percent(row.value, total)}` : ""}`}
            className="group relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              {row.value > 0 && (
                <span
                  className="h-3 rounded-r-[4px] bg-chart-bar transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{ width: `calc((100% - 6rem) * ${row.value / most})` }}
                />
              )}
              <span className="shrink-0 font-medium tabular-nums">
                {row.value.toLocaleString("en-US")}
                {total > 0 && (
                  <span className="ml-1 font-normal text-muted-foreground">{percent(row.value, total)}</span>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// A tooltip above a column, shown while it's hovered or focused.
function Tooltip({ bottom, children }: { bottom: number; children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none invisible absolute z-10 mb-2 flex flex-col items-center rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-md ring-1 ring-foreground/10 group-hover:visible group-focus-visible:visible"
      style={{ bottom: `${bottom}%` }}
    >
      {children}
    </span>
  );
}

// The chart's values as a table, behind a disclosure.
function TableView({ rows, unit }: { rows: ChartRow[]; unit: (value: number) => string }) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        Show as a table
      </summary>
      <table className="mt-2 w-full max-w-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b last:border-b-0">
              <th scope="row" className="py-1 text-left font-normal text-muted-foreground">
                {row.name}
              </th>
              <td className="py-1 text-right tabular-nums">{unit(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// A few round numbers from 0 to at least max: 0, 5, 10, 15.
function niceTicks(max: number) {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough)!;
  const wholeStep = Math.max(1, Math.round(step));
  const ticks = [];
  for (let tick = 0; tick < max + wholeStep; tick += wholeStep) {
    ticks.push(tick);
    if (tick >= max) break;
  }
  return ticks;
}

export function percent(part: number, whole: number) {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}
