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

// Questions to suggest asking an AI assistant about the app.
const EXAMPLE_QUESTIONS = [
  "How do I set up a signup form for a build day?",
  "Why does a build say it's full when it still has empty spots?",
  "How do I reserve a spot for someone who hasn't signed up?",
  "What's the difference between planned and confirmed assignments?",
  "Does the app email volunteers when an event is cancelled?",
];

// Where admins find out how the app works: CONTEXT.md to give an AI
// assistant, and the app's code on GitHub. Every admin can open it.
export default async function HelpPage() {
  await requireAdmin("/admin/help");
  const context = await readContextFile();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="text-sm text-muted-foreground">
          How to find out how this app works, and where its code lives.
        </p>
      </div>

      <section aria-labelledby="ai-heading" className="flex flex-col gap-3">
        <h2 id="ai-heading" className="text-lg font-semibold">
          Ask an AI about this app
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              <span className="font-mono font-medium">CONTEXT.md</span> describes this app: what
              it&apos;s for, how it&apos;s set up, what every page and feature does, and how
              it&apos;s meant to be used. Give it to an AI assistant, such as ChatGPT, Claude or
              Gemini, and you can ask it questions about the app.
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

        <h3 className="font-medium">How to use it</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>Download CONTEXT.md, or copy its text.</li>
          <li>
            Start a new chat with an AI assistant, and attach the file (or paste the text) in your
            first message.
          </li>
          <li>
            Ask your question in the same message or the next one. For example:
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {EXAMPLE_QUESTIONS.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </li>
          <li>Keep asking follow-up questions in that chat. A new chat needs the file again.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          The AI only knows what the file says, so it can get things wrong: check anything
          important in the app itself. Don&apos;t paste volunteers&apos; names, emails, phone
          numbers or other details into an AI chat; it doesn&apos;t need them to answer. The file
          here always matches this version of the app, so download it again after the app changes.
        </p>
      </section>

      <section aria-labelledby="code-heading" className="flex flex-col gap-3">
        <h2 id="code-heading" className="text-lg font-semibold">
          The app&apos;s code
        </h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-muted-foreground">
              The code is on GitHub, with its history and a README on setting it up. It&apos;s
              where developers start, and CONTEXT.md is there too.
            </p>
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
      </section>
    </div>
  );
}
