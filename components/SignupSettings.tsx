"use client";

import { useActionState } from "react";
import { changeDeadlineAction, closeSignupsAction } from "@/app/groups/[groupId]/actions";
import { DeadlineInput } from "@/components/DeadlineInput";
import { FormAlert } from "@/components/FormAlert";
import { buttonSecondary, monoLabel } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

/** Organizer-only: close signups early, or move the close date, until the names are drawn. */
export function SignupSettings({
  groupId,
  open,
  memberCount,
}: {
  groupId: string;
  open: boolean;
  memberCount: number;
}) {
  const [closeState, closeAction, closing] = useActionState(closeSignupsAction, initialState);
  const [dateState, dateAction, saving] = useActionState(changeDeadlineAction, initialState);

  return (
    <section aria-labelledby="settings-title" className="mt-12 border-t border-rule pt-6">
      <h2 id="settings-title" className={`${monoLabel} text-muted`}>
        Signup settings
      </h2>

      {open ? (
        <form
          action={closeAction}
          className="mt-4"
          onSubmit={(event) => {
            const message = `Close signups now with ${memberCount} ${
              memberCount === 1 ? "person" : "people"
            }? Nobody else will be able to join with the code.`;
            if (!window.confirm(message)) event.preventDefault();
          }}
        >
          <input type="hidden" name="groupId" value={groupId} />
          <p className="mb-3 max-w-[44ch] text-sm text-muted">
            Everyone is in already? Close signups now instead of waiting for the date.
          </p>
          <button type="submit" disabled={closing} className={buttonSecondary}>
            {closing ? "Closing..." : "Close signups now"}
          </button>
          {closeState.error ? (
            <FormAlert trigger={closeState} className="mt-3 text-sm font-medium text-accent">
              {closeState.error}
            </FormAlert>
          ) : null}
        </form>
      ) : null}

      <form action={dateAction} className="mt-8">
        <input type="hidden" name="groupId" value={groupId} />
        <label htmlFor="new-deadline" className={`${monoLabel} mb-2 block`}>
          {open ? "Change the close date" : "Reopen signups until"}
        </label>
        <DeadlineInput id="new-deadline" name="signupDeadline" />
        <p className="mt-2 max-w-[44ch] text-sm text-muted">
          {open
            ? "Pick a new date and time. It can be earlier or later than the current one."
            : "Pick a future date and time to let people join again. This only works before the names are drawn."}
        </p>
        <button type="submit" disabled={saving} className={`${buttonSecondary} mt-4`}>
          {saving ? "Saving..." : open ? "Change date" : "Reopen signups"}
        </button>
        {dateState.error ? (
          <FormAlert trigger={dateState} className="mt-3 text-sm font-medium text-accent">
            {dateState.error}
          </FormAlert>
        ) : null}
      </form>
    </section>
  );
}
