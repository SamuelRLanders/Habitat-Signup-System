import { Section } from "@/components/form-fields";
import { LinkedText } from "@/components/linked-text";

// The headings and text an admin added to a signup form, such as which
// waivers to sign and how.
export function FormSections({
  sections,
}: {
  sections: { id: string; title: string; body: string }[];
}) {
  return sections.map((section) => (
    <Section key={section.id} title={section.title}>
      <p className="text-sm whitespace-pre-line">
        <LinkedText text={section.body} />
      </p>
    </Section>
  ));
}
