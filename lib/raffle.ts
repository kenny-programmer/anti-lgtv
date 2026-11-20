import { randomInt } from "node:crypto";

export type Pairing = { giver: string; receiver: string };

export function drawAssignments(
  ids: string[],
  random: (maxExclusive: number) => number = (max) => randomInt(max),
): Pairing[] {
  if (ids.length < 2) throw new Error("A raffle needs at least 2 participants");
  if (new Set(ids).size !== ids.length) throw new Error("Participant ids must be unique");

  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((giver, i) => ({ giver, receiver: order[(i + 1) % order.length] }));
}
