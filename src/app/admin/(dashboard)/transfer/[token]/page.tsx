import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { acceptTransfer } from "@/lib/admins/actions";
import { getTransferByToken } from "@/lib/admins/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Accept ownership" };

// Where an ownership transfer link leads. Opening it changes nothing:
// email scanners open links on their own, so the new owner has to choose
// Accept. Signed-out visitors are sent to sign in first (src/proxy.ts),
// and come back here.
export default async function TransferPage({ params }: PageProps<"/admin/transfer/[token]">) {
  const { token } = await params;
  const admin = await requireAdmin(`/admin/transfer/${token}`);
  const transfer = await getTransferByToken(token);

  if (!transfer) {
    return (
      <Message title="This link no longer works">
        The transfer may have been cancelled, or already accepted. If you were expecting to become the
        owner, ask the owner to send a new link.
      </Message>
    );
  }
  const from = transfer.from.name || transfer.from.email;
  if (transfer.to.id !== admin.id) {
    return (
      <Message title="This link is for someone else">
        It was sent to {transfer.to.email}, but you&apos;re signed in as {admin.email}. To accept, sign
        out, then sign in as {transfer.to.email} and open the link again.
      </Message>
    );
  }
  if (transfer.expiresAt <= new Date()) {
    return (
      <Message title="This link has expired">
        It worked until {formatDateTime(transfer.expiresAt, DEFAULT_TIME_ZONE)}. Ask {from} to send a new
        one.
      </Message>
    );
  }
  if (transfer.from.role !== "OWNER") {
    return (
      <Message title="This link no longer works">
        {from} isn&apos;t the owner anymore, so they can&apos;t hand it over.
      </Message>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Accept ownership?</h1>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <p>
            {from} wants to make you the owner of the Purdue Habitat signup site.
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>You&apos;ll manage the admins on a new Admins page: adding and removing them, and making them editors or viewers.</li>
            <li>You&apos;ll get the email when the site is close to its daily email limit.</li>
            <li>{from} will become an editor, and will be emailed that you accepted.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            This link works until {formatDateTime(transfer.expiresAt, DEFAULT_TIME_ZONE)}. If you don&apos;t
            want to be the owner, you can just close this page.
          </p>
          <div className="flex justify-end">
            <ActionButton action={acceptTransfer.bind(null, token)} label="Accept ownership" variant="default" size="default" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
