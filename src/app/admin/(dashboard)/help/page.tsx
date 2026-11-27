import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { CONTEXT_FILE_PATH, readContextFile } from "./context-file";
import { CopyTextButton } from "./copy-text-button";
import { GitHubIcon } from "./github-icon";

export const metadata: Metadata = { title: "Help" };

const GITHUB_URL = "https://github.com/SamuelRLanders/Habitat-Signup-System";

// CONTEXT.md to give an AI assistant, and the app's code on GitHub. Every
// admin can open it.
export default async function HelpPage() {
  await requireAdmin("/admin/help");
  const context = await readContextFile();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Help</h1>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-semibold">Ask an AI about this app</h2>
          <p className="text-sm text-muted-foreground">
            Attach CONTEXT.md (or paste its text) in a chat with an AI assistant, then ask it how anything in the app works. Don&apos;t share
            volunteers&apos; personal details with it.
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <a href={CONTEXT_FILE_PATH} download="CONTEXT.md" className={buttonVariants()}>
              <DownloadIcon data-icon="inline-start" />
              Download CONTEXT.md
            </a>
            <CopyTextButton text={context} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">The app&apos;s code</h2>
            <p className="text-sm text-muted-foreground">On GitHub, with a README on setting it up.</p>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <GitHubIcon className="size-4" />
            View on GitHub
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
