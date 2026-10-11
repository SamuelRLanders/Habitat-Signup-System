"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// A submit button that shows it's working while its <form action={...}>
// runs, for forms rendered by Server Components, which can't track that
// themselves.
export function SubmitButton(props: Omit<React.ComponentProps<typeof Button>, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}
