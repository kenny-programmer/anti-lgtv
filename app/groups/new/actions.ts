"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { createGroup } from "@/lib/groups";
import { requireUser } from "@/lib/session";

const MESSAGES = {
  invalid_name: "Give your group a name (up to 80 characters).",
  invalid_display_name: "Enter the name your group will see (up to 40 characters).",
  deadline_in_past: "Pick a signup deadline in the future.",
} as const;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = readString(formData, "name");
  const displayName = readString(formData, "displayName");
  const result = await createGroup(getDb(), {
    userId: user.id,
    name,
    displayName,
    signupDeadline: new Date(readString(formData, "signupDeadline")),
  });
  if (!result.ok) return { error: MESSAGES[result.error], values: { name, displayName } };
  redirect(`/groups/${result.group.id}`);
}
