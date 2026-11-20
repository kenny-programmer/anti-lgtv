"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { readString } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import { joinGroup } from "@/lib/groups";
import { requireUser } from "@/lib/session";

const MESSAGES = {
  invalid_display_name: "Enter the name your group will see (up to 40 characters).",
  unknown_code: "We could not find a group with that code. Double-check it with whoever invited you.",
  closed: "Signups for this group have closed.",
  name_taken: "Someone in this group already uses that name. Pick a different one.",
} as const;

export async function joinGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const inviteCode = readString(formData, "inviteCode");
  const displayName = readString(formData, "displayName");
  const result = await joinGroup(getDb(), { userId: user.id, inviteCode, displayName });
  if (result.ok) redirect(`/groups/${result.groupId}`);
  if (result.error === "already_member") redirect(`/groups/${result.groupId}`);
  return { error: MESSAGES[result.error], values: { inviteCode, displayName } };
}
