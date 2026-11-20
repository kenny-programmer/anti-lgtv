"use client";

import { useActionState } from "react";
import { joinGroupAction } from "@/app/groups/join/actions";
import { FormAlert } from "@/components/FormAlert";
import { buttonPrimary, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function JoinGroupForm({ initialCode }: { initialCode: string }) {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-7">
      <div>
        <label
          htmlFor="inviteCode"
          className="block font-mono text-xs font-medium uppercase tracking-[0.08em]"
        >
          Invite code
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          required
          maxLength={12}
          defaultValue={state.values?.inviteCode ?? initialCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD-1234"
          className={`${inputClass} mt-2 font-mono uppercase tracking-[0.12em]`}
        />
      </div>
      <div>
        <label
          htmlFor="displayName"
          className="block font-mono text-xs font-medium uppercase tracking-[0.08em]"
        >
          Your name in this group
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={40}
          defaultValue={state.values?.displayName ?? ""}
          placeholder="What should everyone call you?"
          className={`${inputClass} mt-2`}
        />
        <p className="mt-2 text-sm text-muted">
          This is what the group sees. We never show your Google name.
        </p>
      </div>
      {state.error ? (
        <FormAlert trigger={state} className="text-sm font-medium text-accent">
          {state.error}
        </FormAlert>
      ) : null}
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full sm:w-auto`}>
        {pending ? "Joining..." : "Join group"}
      </button>
    </form>
  );
}
