"use client";

import { useActionState } from "react";
import { createGroupAction } from "@/app/groups/new/actions";
import { DeadlineInput } from "@/components/DeadlineInput";
import { buttonPrimary, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-7">
      <div>
        <label
          htmlFor="name"
          className="block font-mono text-xs font-medium uppercase tracking-[0.08em]"
        >
          Group name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={state.values?.name ?? ""}
          placeholder="Office gift exchange"
          className={`${inputClass} mt-2`}
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
      <div>
        <label
          htmlFor="signupDeadline"
          className="block font-mono text-xs font-medium uppercase tracking-[0.08em]"
        >
          Last day to sign up
        </label>
        <div className="mt-2">
          <DeadlineInput id="signupDeadline" name="signupDeadline" />
        </div>
        <p className="mt-2 text-sm text-muted">
          Signups close at this time, and you can run the raffle once it has passed.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full sm:w-auto`}>
        {pending ? "Creating..." : "Create group"}
      </button>
    </form>
  );
}
