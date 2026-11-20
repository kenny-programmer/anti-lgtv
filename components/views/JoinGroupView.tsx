import { Header } from "@/components/Header";
import { JoinGroupForm } from "@/components/JoinGroupForm";
import { monoLabel } from "@/components/ui";
import { SiteFooter } from "@/components/SiteFooter";

export function JoinGroupView({ initialCode }: { initialCode: string }) {
  return (
    <>
      <Header signedIn />
      <main className="page-enter mx-auto grid max-w-6xl gap-x-16 gap-y-10 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-12 lg:pt-16">
        <div className="lg:col-span-5">
          <p className={`${monoLabel} text-muted`}>Got a code?</p>
          <h1 className="mt-3 font-serif text-[clamp(2.75rem,6vw,4.5rem)] leading-none tracking-[-0.02em]">
            Join a group
          </h1>
          <p className="mt-6 max-w-[40ch] text-lg text-muted">
            Enter the invite code you were given, then choose the name the group will see.
          </p>
        </div>
        <div className="max-w-xl border-t border-ink pt-8 lg:col-span-6 lg:col-start-7">
          <JoinGroupForm initialCode={initialCode} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
