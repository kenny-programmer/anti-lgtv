"use client";

import { useActionState } from "react";
import { runRaffleAction } from "@/app/groups/[groupId]/actions";
import { FormAlert } from "@/components/FormAlert";
import { ARRIVAL_KEY } from "@/components/ScrollOnArrival";
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
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        // Presentation only: once the names are drawn, glide to the new reveal tag.
        try {
          window.sessionStorage.setItem(ARRIVAL_KEY, groupId);
        } catch {
          // Without storage the page simply does not scroll.
        }
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Drawing names..." : "Run the raffle"}
      </button>
      {state.error ? (
        <FormAlert trigger={state} className="mt-3 text-sm font-medium text-accent">
          {state.error}
        </FormAlert>
      ) : null}
    </form>
  );
}
