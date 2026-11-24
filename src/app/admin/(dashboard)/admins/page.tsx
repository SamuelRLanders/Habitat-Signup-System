import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancelTransfer, removeAdmin, setAdminRole } from "@/lib/admins/actions";
import { getPendingTransfer, listAdmins } from "@/lib/admins/queries";
import { requireOwner } from "@/lib/auth/dal";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { emailsSentToday } from "@/lib/email";
import { emailLimitNote } from "@/lib/email-limit";
import { DEFAULT_TIME_ZONE, formatDate, formatDateTime } from "@/lib/time";
import { AddAdminDialog } from "./add-admin-dialog";
import { TransferDialog } from "./transfer-dialog";

export const metadata: Metadata = { title: "Admins" };

// The owner's page for managing who can sign in: adding admins, making
// them editors or viewers, removing them, and handing ownership to one of
// them. Only the owner can open it.
export default async function AdminsPage() {
  const owner = await requireOwner();
  const [admins, pending, sentToday] = await Promise.all([
    listAdmins(),
    getPendingTransfer(),
    emailsSentToday(),
  ]);
  // Each of the owner's actions here that emails sends one email.
  const limitNote = emailLimitNote(sentToday, 1);
  const others = admins.filter((admin) => admin.id !== owner.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Admins</h1>
          <AddAdminDialog limitNote={limitNote} />
        </div>
        <p className="text-sm text-muted-foreground">
          Everyone who can sign in to the admin pages. Editors can change
          forms, signups, assignments, people and drivers; viewers can see
          everything, and download it, but can&apos;t change anything. As the
          owner, you manage the admins, and you get the email when the site
          is close to its daily email limit.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Admins ({admins.length})</h2>
        <div className="hover-gold rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => {
                const name = admin.name || admin.email;
                const isOwner = admin.role === "OWNER";
                // Removing them, or making them a viewer, hands their
                // upcoming builds to the owner.
                const builds =
                  admin.upcomingBuilds > 0
                    ? `${name} is the responsible admin for ${admin.upcomingBuilds} upcoming ${admin.upcomingBuilds === 1 ? "build" : "builds"}. You'll become responsible for ${admin.upcomingBuilds === 1 ? "it" : "them"} instead, and can choose someone else in each form's editor.`
                    : null;
                return (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.name || <span className="text-muted-foreground">No name</span>}
                      {admin.id === owner.id && <span className="font-normal text-muted-foreground"> (you)</span>}
                    </TableCell>
                    <TableCell>
                      <a href={`mailto:${admin.email}`} className="hover:underline">
                        {admin.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={admin.role} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(admin.createdAt, DEFAULT_TIME_ZONE)}
                    </TableCell>
                    <TableCell>
                      {!isOwner && (
                        <div className="flex items-start justify-end gap-1">
                          <ActionButton
                            action={setAdminRole.bind(null, admin.id, admin.role === "VIEWER" ? "EDITOR" : "VIEWER")}
                            label={admin.role === "VIEWER" ? "Make editor" : "Make viewer"}
                            variant="ghost"
                            confirm={
                              admin.role !== "VIEWER" && builds
                                ? {
                                    title: `Make ${name} a viewer?`,
                                    description: `Viewers can't change anything or organize builds. ${builds} No email is sent.`,
                                    confirmLabel: "Make viewer",
                                  }
                                : undefined
                            }
                          />
                          <ActionButton
                            action={removeAdmin.bind(null, admin.id)}
                            label="Remove"
                            variant="ghost"
                            confirm={{
                              title: `Remove ${name}?`,
                              description: `${name} won't be able to sign in to the admin pages, and is signed out everywhere now. The forms they created and the driver decisions they made are kept.${builds ? ` ${builds}` : ""} No email is sent. You can add them again later.`,
                              confirmLabel: "Remove admin",
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {(["EDITOR", "VIEWER"] as const).map((role) => (
            <li key={role}>
              <span className="font-medium text-foreground">{ROLE_LABELS[role]}:</span> {ROLE_DESCRIPTIONS[role]}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Transfer ownership</h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            {pending ? (
              <>
                <p className="max-w-xl text-sm">
                  Waiting for <span className="font-medium">{pending.to.name || pending.to.email}</span> (
                  {pending.to.email}) to accept. Their link works until{" "}
                  {formatDateTime(pending.expiresAt, DEFAULT_TIME_ZONE)}. You&apos;re the owner until they
                  accept.
                </p>
                <ActionButton
                  action={cancelTransfer}
                  label="Cancel transfer"
                  confirm={{
                    title: "Cancel the transfer?",
                    description: `The link sent to ${pending.to.name || pending.to.email} will stop working, and you'll stay the owner. No email is sent.`,
                    confirmLabel: "Cancel transfer",
                  }}
                />
              </>
            ) : (
              <>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Hand the site over to another admin. They&apos;re emailed a link, and become the owner
                  once they open it and accept. Until then you stay the owner, and you can cancel. After,
                  you&apos;ll be an editor.
                </p>
                <TransferDialog
                  admins={others.map((admin) => ({ id: admin.id, name: admin.name, email: admin.email }))}
                  limitNote={limitNote}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const variant = role === "OWNER" ? "default" : role === "EDITOR" ? "secondary" : "outline";
  return <Badge variant={variant}>{ROLE_LABELS[role]}</Badge>;
}
