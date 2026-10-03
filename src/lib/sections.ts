import * as z from "zod";
import { firstErrors } from "@/lib/forms";

// Headings and text shown on a signup form, such as instructions for each
// waiver. The form sends one "sectionTitle" and one "sectionBody" per
// section, in order.

export const MAX_SECTIONS = 20;

export type SectionErrors = Partial<Record<"title" | "body", string>>;

const sectionSchema = z.object({
  title: z.string().trim().min(1, "Enter a heading.").max(120, "Keep the heading under 120 characters."),
  body: z.string().trim().min(1, "Enter some text.").max(10000, "Keep the text under 10,000 characters."),
});

// The sections with their positions, or the problems with each, by their
// position in the form.
export function parseSections(formData: FormData) {
  const titles = formData.getAll("sectionTitle");
  const bodies = formData.getAll("sectionBody");
  if (titles.length > MAX_SECTIONS) {
    return { ok: false as const, form: `A form can have at most ${MAX_SECTIONS} sections.` };
  }

  const sections: z.output<typeof sectionSchema>[] = [];
  const errors: Record<number, SectionErrors> = {};
  titles.forEach((title, index) => {
    const parsed = sectionSchema.safeParse({ title, body: bodies[index] ?? "" });
    if (parsed.success) sections.push(parsed.data);
    else errors[index] = firstErrors(parsed.error);
  });

  if (Object.keys(errors).length > 0) return { ok: false as const, errors };
  return {
    ok: true as const,
    sections: sections.map((section, position) => ({ ...section, position })),
  };
}
