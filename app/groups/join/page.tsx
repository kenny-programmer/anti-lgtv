import { JoinGroupView } from "@/components/views/JoinGroupView";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Join a group" };

export default async function JoinGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  await requireUser();
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code : "";

  return <JoinGroupView initialCode={initialCode} />;
}
