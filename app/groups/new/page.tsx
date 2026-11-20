import { CreateGroupForm } from "@/components/CreateGroupForm";
import { Header } from "@/components/Header";
import { cardClass } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Create a group" };

export default async function NewGroupPage() {
  await requireUser();
  return (
    <>
      <Header signedIn />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Create a group</h1>
        <p className="mt-2 text-muted">
          You will get an invite code to share with the people you want in the exchange.
        </p>
        <div className={`${cardClass} mt-6`}>
          <CreateGroupForm />
        </div>
      </main>
    </>
  );
}
