import { Header } from "@/components/Header";
import { JoinGroupForm } from "@/components/JoinGroupForm";
import { cardClass } from "@/components/ui";

export function JoinGroupView({ initialCode }: { initialCode: string }) {
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
