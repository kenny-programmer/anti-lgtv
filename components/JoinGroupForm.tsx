"use client";

import { useActionState } from "react";
import { joinGroupAction } from "@/app/groups/join/actions";
import { buttonPrimary, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function JoinGroupForm({ initialCode }: { initialCode: string }) {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="inviteCode" className="block text-sm font-semibold">
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
          className={`${inputClass} mt-1 font-mono uppercase tracking-widest`}
        />
      </div>
      <div>
        <label htmlFor="displayName" className="block text-sm font-semibold">
          Your name in this group
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={40}
          defaultValue={state.values?.displayName ?? ""}
          placeholder="What should everyone call you?"
          className={`${inputClass} mt-1`}
        />
        <p className="mt-1 text-sm text-muted">
          This is what the group sees. We never show your Google name.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Joining..." : "Join group"}
      </button>
    </form>
  );
}
