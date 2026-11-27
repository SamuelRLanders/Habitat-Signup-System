"use server";

import { textWhere } from "@/lib/admin/queries";
import { requireEditor } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

// Finding a volunteer to reserve a spot for, in the form editor's "Reserve a
// spot" popup. The spot itself is saved with the form. Calls
// requireEditor() first: anyone can post to a Server Action.

export type ReserveCandidate = {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  blocked: string | null;
};

const CANDIDATE_LIMIT = 6;

// Volunteers matching a search, by name, email or phone. Whether they're free
// that day is checked when the form is saved, since its day can still change
// in the editor.
export async function searchToReserve(query: string): Promise<{ matches: ReserveCandidate[]; more: boolean }> {
  await requireEditor();
  const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
  const where = q ? textWhere({ by: "any", q }) : null;
  if (!where) return { matches: [], more: false };

  const volunteers = await prisma.volunteer.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    take: CANDIDATE_LIMIT + 1,
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  return {
    matches: volunteers.slice(0, CANDIDATE_LIMIT).map((volunteer) => ({
      ...volunteer,
      name: `${volunteer.firstName} ${volunteer.lastName}`,
      blocked: null,
    })),
    more: volunteers.length > CANDIDATE_LIMIT,
  };
}
