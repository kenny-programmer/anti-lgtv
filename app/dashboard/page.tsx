import { DashboardView } from "@/components/views/DashboardView";
import { getDb } from "@/lib/db";
import { listGroupsForUser } from "@/lib/groups";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Your groups" };

export default async function DashboardPage() {
  const user = await requireUser();
  const groups = await listGroupsForUser(getDb(), user.id);
  const now = new Date();

  return <DashboardView groups={groups} now={now} />;
}
