"use client";

import { useActionState } from "react";
import { runRaffleAction } from "@/app/groups/[groupId]/actions";
import { buttonPrimary } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function RaffleButton({ groupId, memberCount }: { groupId: string; memberCount: number }) {
  const [state, formAction, pending] = useActionState(runRaffleAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = `Run the raffle for ${memberCount} people? This cannot be undone.`;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Drawing names..." : "Run the raffle"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
