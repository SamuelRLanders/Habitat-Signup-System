"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SectionErrors } from "@/lib/builds/actions";
import { FieldError } from "./build-form";

export type SectionDefaults = { title: string; body: string };

// The headings and text shown on the build's signup form, such as
// instructions for each waiver. Sends one "sectionTitle" and one
// "sectionBody" per section, in order. The inputs are uncontrolled and keyed,
// so moving a section moves what's been typed with it.
export function SectionFields({
  defaults,
  errors,
}: {
  defaults: SectionDefaults[];
  errors: Record<number, SectionErrors>;
}) {
  const [sections, setSections] = useState(() =>
    defaults.map((section) => ({ ...section, key: crypto.randomUUID() })),
  );

  function add() {
    setSections((current) => [
      ...current,
      { title: "", body: "", key: crypto.randomUUID() },
    ]);
  }

  function remove(index: number) {
    setSections((current) => current.filter((_, i) => i !== index));
  }

  function move(index: number, by: -1 | 1) {
    setSections((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  return (
    <div role="group" aria-labelledby="sections-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p id="sections-heading" className="text-sm font-medium">
          Signup form sections{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Each section shows a heading and text on the signup form, in this
          order. Use them for waiver links and how to fill each one out. Links
          you paste become clickable.
        </p>
      </div>

      {sections.map((section, index) => {
        const sectionErrors = errors[index] ?? {};
        const id = `section-${section.key}`;
        return (
          <div
            key={section.key}
            className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Section {index + 1}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move section ${index + 1} up`}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(index, 1)}
                  disabled={index === sections.length - 1}
                  aria-label={`Move section ${index + 1} down`}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove section ${index + 1}`}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-title`}>Heading</Label>
              <Input
                id={`${id}-title`}
                name="sectionTitle"
                defaultValue={section.title}
                placeholder="e.g. Purdue waiver"
                autoComplete="off"
                aria-invalid={sectionErrors.title ? true : undefined}
                aria-describedby={sectionErrors.title ? `${id}-title-error` : undefined}
              />
              <FieldError field={`${id}-title`} error={sectionErrors.title} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-body`}>Text</Label>
              <Textarea
                id={`${id}-body`}
                name="sectionBody"
                defaultValue={section.body}
                rows={4}
                placeholder="e.g. Fill out the Purdue waiver at https://… and choose “Habitat for Humanity” as the organization."
                aria-invalid={sectionErrors.body ? true : undefined}
                aria-describedby={sectionErrors.body ? `${id}-body-error` : undefined}
              />
              <FieldError field={`${id}-body`} error={sectionErrors.body} />
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={add} className="w-fit">
        <PlusIcon data-icon="inline-start" />
        Add section
      </Button>
    </div>
  );
}
