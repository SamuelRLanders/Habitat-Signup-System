import { Section } from "@/components/form-fields";
import { LinkedText } from "@/components/linked-text";

// The headings and text an admin added to a build, such as which waivers to
// sign and how. Shown on the signup form and the group join page.
export function BuildSections({
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
