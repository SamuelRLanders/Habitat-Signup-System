import { LinkedText } from "@/components/linked-text";

// The headings and text an admin added to a signup form, such as which
// waivers to sign and how, one after another.
export function FormSections({
  sections,
}: {
  sections: { id: string; title: string; body: string }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <h3 className="font-medium">{section.title}</h3>
          <p className="text-sm whitespace-pre-line">
            <LinkedText text={section.body} />
          </p>
        </div>
      ))}
    </div>
  );
}
