"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { readString } from "@/lib/form-data";
import type { FormState } from "@/lib/form-state";
import { MIN_MEMBERS } from "@/lib/group-status";
import { revealAssignment, runRaffle } from "@/lib/raffle-service";
import { requireUser } from "@/lib/session";

const RAFFLE_MESSAGES = {
  not_found: "We could not find that group.",
  not_admin: "Only the organizer can run the raffle.",
  too_early: "The raffle can only run after the signup deadline.",
  already_raffled: "The names have already been drawn.",
  not_enough_members: `You need at least ${MIN_MEMBERS} people before the raffle can run.`,
} as const;

export async function runRaffleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = readString(formData, "groupId");
  const result = await runRaffle(getDb(), { groupId, userId: user.id });
  if (!result.ok) return { error: RAFFLE_MESSAGES[result.error] };
  revalidatePath(`/groups/${groupId}`);
  return { error: null };
}

export async function revealMatchAction(
  groupId: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const result = await revealAssignment(getDb(), { groupId, userId: user.id });
  if (!result.ok) return { ok: false, error: "No match is available yet." };
  return { ok: true, name: result.receiverName };
}
