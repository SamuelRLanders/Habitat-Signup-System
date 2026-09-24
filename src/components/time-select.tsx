"use client";

import { ClockIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Build days run during daylight hours, so the list covers 5:00 AM to
// 10:00 PM in 15-minute steps rather than all 96 times in a day.
const FIRST_MINUTE = 5 * 60;
const LAST_MINUTE = 22 * 60;
const STEP = 15;

const TIMES = Array.from(
  { length: (LAST_MINUTE - FIRST_MINUTE) / STEP + 1 },
  (_, i) => toOption(FIRST_MINUTE + i * STEP),
);

function toOption(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  const label = `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
  return { value, label };
}

type TimeSelectProps = {
  id?: string;
  name: string;
  // "08:00" (24-hour). The form receives the same format.
  defaultValue?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function TimeSelect({ id, name, defaultValue, ...aria }: TimeSelectProps) {
  // Keep a saved time that isn't on the list (e.g. 4:10 AM) selectable.
  let items = TIMES;
  if (defaultValue && !TIMES.some((time) => time.value === defaultValue)) {
    const [hours, mins] = defaultValue.split(":").map(Number);
    items = [...TIMES, toOption(hours * 60 + mins)].sort((a, b) =>
      a.value.localeCompare(b.value),
    );
  }

  return (
    <Select name={name} items={items} defaultValue={defaultValue || null}>
      <SelectTrigger id={id} {...aria} className="w-full">
        <ClockIcon className="text-muted-foreground" />
        <SelectValue placeholder="Pick a time" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {items.map((time) => (
          <SelectItem key={time.value} value={time.value}>
            {time.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
