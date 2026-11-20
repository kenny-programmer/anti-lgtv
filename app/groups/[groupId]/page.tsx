import { notFound } from "next/navigation";
import { GroupPageView } from "@/components/views/GroupPageView";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/session";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await requireUser();
  const { groupId } = await params;
  const group = await getGroupForMember(getDb(), { groupId, userId: user.id });
  if (!group) notFound();

  return <GroupPageView group={group} now={new Date()} />;
}
