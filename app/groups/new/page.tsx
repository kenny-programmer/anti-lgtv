import { CreateGroupView } from "@/components/views/CreateGroupView";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Create a group" };

export default async function NewGroupPage() {
  await requireUser();
  return <CreateGroupView />;
}
