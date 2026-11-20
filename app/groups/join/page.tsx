import { Header } from "@/components/Header";
import { JoinGroupForm } from "@/components/JoinGroupForm";
import { cardClass } from "@/components/ui";
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

  return (
    <>
      <Header signedIn />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Join a group</h1>
        <p className="mt-2 text-muted">
          Enter the invite code you were given, then choose the name the group will see.
        </p>
        <div className={`${cardClass} mt-6`}>
          <JoinGroupForm initialCode={initialCode} />
        </div>
      </main>
    </>
  );
}
