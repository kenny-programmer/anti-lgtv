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
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold">
          Group name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={state.values?.name ?? ""}
          placeholder="Office gift exchange"
          className={`${inputClass} mt-1`}
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
      <div>
        <label htmlFor="signupDeadline" className="block text-sm font-semibold">
          Last day to sign up
        </label>
        <div className="mt-1">
          <DeadlineInput id="signupDeadline" name="signupDeadline" />
        </div>
        <p className="mt-1 text-sm text-muted">
          Signups close at this time, and you can run the raffle once it has passed.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Creating..." : "Create group"}
      </button>
    </form>
  );
}
