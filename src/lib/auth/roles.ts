// Admin roles, shared by the server checks (dal.ts) and the pages that hide
// controls an admin can't use. Kept free of server-only imports so client
// components can use the labels.

export const ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

// The roles the owner can give when adding an admin or changing one. Owner
// only changes hands by transfer.
export const ASSIGNABLE_ROLES = ["EDITOR", "VIEWER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// Whether the admin can change anything (everyone but viewers).
export function canEdit(role: Role) {
  return role !== "VIEWER";
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Can do everything editors can, manage the admins, and gets the daily email limit warning.",
  EDITOR: "Can see and change forms, signups, assignments, people and drivers.",
  VIEWER: "Can see the admin pages and download their data, but can't change anything.",
};
