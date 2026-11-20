import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Header } from "@/components/Header";
import { buttonPrimary, cardClass } from "@/components/ui";
import { SITE_NAME } from "@/lib/site";

const STEPS = [
  {
    title: "Create a group",
    body: "Sign in with Google, name your group and set the last day people can sign up.",
  },
  {
    title: "Share the invite code",
    body: "Friends join with a short 8-character code and choose the name the group will see. Google names are never shown.",
  },
  {
    title: "Raffle and reveal",
    body: "After the deadline the organizer runs the raffle. Everyone taps a button to find out who they are gifting.",
  },
];

export default async function LandingPage() {
  const { user } = await withAuth();
  if (user) redirect("/dashboard");

  return (
    <>
      <Header signedIn={false} />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Draw names. Keep the secret. Make gifting fun.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            {SITE_NAME} runs a private gift exchange for your friends or family. One click decides
            who gives to whom. Nobody gets themselves, and nobody is picked twice.
          </p>
          <div className="mt-8">
            <a href="/sign-in" className={`${buttonPrimary} px-6 py-3 text-base`}>
              Sign in with Google
            </a>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className={cardClass}>
              <p className="text-sm font-semibold text-accent">Step {index + 1}</p>
              <h2 className="mt-1 text-lg font-bold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </section>

        <p className="mt-12 text-center text-sm text-muted">
          Groups are private. Only people with your invite code can see or join them.
        </p>
      </main>
    </>
  );
}
