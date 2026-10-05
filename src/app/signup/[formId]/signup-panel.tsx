"use client";

import { useState } from "react";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";

// A volunteer's existing signup: a summary with Update and Cancel buttons,
// or, after "Update my signup", the form filled in with their answers.
// Keyed by the signup's last change, so a saved update shows the summary.
export function SignupPanel({
  summary,
  editForm,
  cancelButton,
}: {
  summary: React.ReactNode;
  // Null once the form has closed: then the signup can only be cancelled.
  editForm: React.ReactNode | null;
  cancelButton: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && editForm) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setEditing(false)}>
          Keep my signup as it is
        </Button>
        {editForm}
      </div>
    );
  }

  return (
    <Panel title="Your signup">
      {summary}
      <div className="flex flex-wrap gap-2">
        {editForm && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Update my signup
          </Button>
        )}
        {cancelButton}
      </div>
    </Panel>
  );
}
