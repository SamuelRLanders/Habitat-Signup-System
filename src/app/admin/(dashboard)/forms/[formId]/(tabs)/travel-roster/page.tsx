import { redirect } from "next/navigation";

// The travel roster is copied from the Assignments tab now. This keeps
// links in emails sent before then working.
export default async function TravelRosterPage({
  params,
}: PageProps<"/admin/forms/[formId]/travel-roster">) {
  const { formId } = await params;
  redirect(`/admin/forms/${formId}/assignments`);
}
