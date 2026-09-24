"use client";

import { compareAsc, format, startOfToday, subYears } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DatePickerProps = {
  id?: string;
  name: string;
  // "2026-10-04". The form receives the same format.
  defaultValue?: string;
  placeholder?: string;
  disablePast?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const triggerClass =
  "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-popup-open:border-ring md:text-sm dark:bg-input/30";

const calendarClass =
  "rounded-lg [--cell-radius:9999px] [--cell-size:--spacing(8)]";

// A calendar in a popover. Submits the chosen day as YYYY-MM-DD through a
// hidden input, like <input type="date">.
export function DatePicker({
  id,
  name,
  defaultValue,
  placeholder = "Pick a date",
  disablePast,
  birthday,
  ...aria
}: DatePickerProps & {
  // Month and year dropdowns instead of arrows, no future days, and opens
  // about 30 years back, so a birthday is a few clicks away.
  birthday?: boolean;
}) {
  const [date, setDate] = useState(() => parseDay(defaultValue));
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger id={id} {...aria} className={triggerClass}>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        {date ? (
          format(date, "EEE, MMM d, yyyy")
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date ?? (birthday ? subYears(startOfToday(), 30) : undefined)}
          onSelect={(day) => {
            setDate(day);
            setOpen(false);
          }}
          disabled={
            disablePast
              ? { before: startOfToday() }
              : birthday
                ? { after: startOfToday() }
                : undefined
          }
          {...(birthday && {
            captionLayout: "dropdown",
            startMonth: new Date(1900, 0),
            endMonth: startOfToday(),
          })}
          className={calendarClass}
        />
      </PopoverContent>
      <input type="hidden" name={name} value={date ? toValue(date) : ""} />
    </Popover>
  );
}

type MultiDatePickerProps = Omit<DatePickerProps, "defaultValue"> & {
  onChange?: (dates: Date[]) => void;
};

// Like DatePicker, but the calendar stays open so several days can be
// picked. Each day is submitted as its own hidden input with the same name,
// so the server reads them with formData.getAll(name).
export function MultiDatePicker({
  id,
  name,
  disablePast,
  onChange,
  ...aria
}: MultiDatePickerProps) {
  const [dates, setDates] = useState<Date[]>([]);
  const [open, setOpen] = useState(false);

  function update(next: Date[]) {
    const sorted = [...next].sort(compareAsc);
    setDates(sorted);
    onChange?.(sorted);
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger id={id} {...aria} className={triggerClass}>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          {dates.length === 0 ? (
            <span className="text-muted-foreground">Pick one or more dates</span>
          ) : dates.length === 1 ? (
            format(dates[0], "EEE, MMM d, yyyy")
          ) : (
            `${dates.length} dates selected`
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="multiple"
            selected={dates}
            defaultMonth={dates[0]}
            onSelect={(days) => update(days ?? [])}
            disabled={disablePast ? { before: startOfToday() } : undefined}
            className={calendarClass}
          />
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={dates.length === 0}
              onClick={() => update([])}
            >
              Clear
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {dates.length > 1 && (
        <ul aria-label="Selected dates" className="flex flex-wrap gap-1.5">
          {dates.map((date) => (
            <li
              key={toValue(date)}
              className="flex h-6 items-center gap-0.5 rounded-full bg-muted pr-0.5 pl-2.5 text-xs font-medium"
            >
              {format(date, "EEE, MMM d")}
              <button
                type="button"
                aria-label={`Remove ${format(date, "MMMM d")}`}
                onClick={() => update(dates.filter((d) => d !== date))}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {dates.map((date) => (
        <input key={toValue(date)} type="hidden" name={name} value={toValue(date)} />
      ))}
    </div>
  );
}

function toValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseDay(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
