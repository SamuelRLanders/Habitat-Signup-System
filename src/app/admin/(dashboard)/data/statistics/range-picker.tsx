"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_PRESETS, rangeDays, rangeQuery, type RangePreset, type StatsRange } from "@/lib/data/stats-range";

// The Statistics tab's time range: a preset, or custom dates with an Apply
// button. Choosing one changes the URL, and the page works the numbers out
// again on the server. Everything below it follows the range.
export function RangePicker({ range }: { range: StatsRange }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preset, setPreset] = useState<RangePreset>(range.preset);

  // Follow the URL when it changes from outside, e.g. the back button.
  const [shown, setShown] = useState(range.preset);
  if (shown !== range.preset) {
    setShown(range.preset);
    setPreset(range.preset);
  }

  function go(next: Pick<StatsRange, "preset" | "from" | "to">) {
    const query = rangeQuery(next);
    startTransition(() => router.push(`/admin/data/statistics${query ? `?${query}` : ""}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <Select
        items={RANGE_PRESETS}
        value={preset}
        onValueChange={(value) => {
          const next = value as RangePreset;
          setPreset(next);
          if (next !== "custom") go({ preset: next, from: null, to: null });
        }}
      >
        <SelectTrigger aria-label="Time range" className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_PRESETS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const day = (key: string) => {
              const value = data.get(key);
              return typeof value === "string" && value ? value : null;
            };
            go({ preset: "custom", from: day("from"), to: day("to") });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="w-48">
            <DatePicker
              name="from"
              aria-label="From"
              placeholder="Any start"
              defaultValue={range.preset === "custom" ? (range.from ?? undefined) : undefined}
              clearable
            />
          </div>
          <span className="text-sm text-muted-foreground">to</span>
          <div className="w-48">
            <DatePicker
              name="to"
              aria-label="To"
              placeholder="Any end"
              defaultValue={range.preset === "custom" ? (range.to ?? undefined) : undefined}
              clearable
            />
          </div>
          <Button type="submit" loading={pending}>
            Apply
          </Button>
        </form>
      ) : (
        <span className="text-sm text-muted-foreground">
          {pending ? "Loading…" : rangeDays(range)}
        </span>
      )}
    </div>
  );
}
