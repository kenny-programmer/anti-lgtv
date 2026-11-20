import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { GiftTag } from "@/components/GiftTag";
import { Header } from "@/components/Header";
import { Twine } from "@/components/Twine";
import { buttonPrimary, monoLabel, textLink } from "@/components/ui";
import { SITE_NAME } from "@/lib/site";

const STEPS = [
  {
    title: "Start a group",
    body: "Sign in with Google, name the exchange and set the last day people can sign up.",
  },
  {
    title: "Hand out the code",
    body: "Friends join with a short invite code and pick the name the group will see. Google names are never shown.",
  },
  {
    title: "Draw once",
    body: "After the deadline the organizer runs the draw, one time. Nobody draws themselves, and nobody is drawn twice.",
  },
  {
    title: "Open your own tag",
    body: "Everyone reveals their own match, and only theirs. Who is buying for whom stays a secret.",
  },
];

export default async function LandingPage() {
  const { user } = await withAuth();
  if (user) redirect("/dashboard");

  return (
    <>
      <div className="surface-ink wrapping-dots relative overflow-hidden">
        <Header signedIn={false} />

        <section className="relative mx-auto grid max-w-6xl grid-cols-12 gap-x-6 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:pb-28 lg:pt-20">
          <div className="col-span-12 lg:col-span-7">
            <p className={`${monoLabel} rise text-surface-muted`}>
              Secret Santa <span aria-hidden="true">/</span> Holiday gift exchange
            </p>
            <h1 className="rise mt-6 font-serif text-[clamp(3.5rem,9vw,7rem)] font-normal leading-[0.98] tracking-[-0.02em] text-balance [animation-delay:60ms]">
              Secret Santa, <em className="italic">without</em> the hat.
            </h1>
            <p className="rise mt-8 max-w-[36rem] text-lg leading-relaxed text-pretty text-surface-muted [animation-delay:120ms]">
              Start a private group and hand out the invite code. When signups close, the organizer
              draws the names once, and everyone opens only their own tag. Nobody draws themselves.
              Nobody is drawn twice.
            </p>
            <div className="rise mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 [animation-delay:180ms]">
              <a href="/sign-in" className={buttonPrimary}>
                Sign in with Google
              </a>
              <a href="#how" className={textLink}>
                How the draw works
              </a>
            </div>
          </div>

          <div className="relative col-span-12 mt-16 lg:col-span-5 lg:mt-0">
            {/* Wide ribbon: vertical on large screens, horizontal on small ones. */}
            <div
              aria-hidden="true"
              className="ribbon-band left-1/2 top-[-60rem] bottom-[-60rem] hidden w-16 -translate-x-1/2 lg:block"
              data-axis="y"
            />
            <div
              aria-hidden="true"
              className="ribbon-band -left-[50vw] -right-[50vw] top-0 z-10 h-12 lg:hidden"
              data-axis="x"
            />
            <div className="rise relative mx-auto w-[17.5rem] [animation-delay:240ms] sm:w-[19rem] lg:mt-6 lg:w-[20rem]">
              <Twine className="absolute hidden left-1/2 top-[-0.4rem] z-10 w-[5.25rem] -translate-x-1/2 lg:block lg:w-[5.5rem]" />
              <GiftTag
                stringLength={110}
                bodyClassName="lg:pb-8 lg:pt-[5.5rem]"
                footer={
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={monoLabel}>From:</span>
                    <span className="font-serif text-2xl italic">Secret Santa</span>
                  </div>
                }
              >
                <div className="mt-3 flex h-16 items-end bg-ink px-3 pb-2.5">
                  <span className={`${monoLabel} text-paper`}>Hidden until the draw</span>
                </div>
                <p className="mt-6 max-w-[16rem] text-sm leading-snug lg:mb-10">
                  One name per tag. You only ever open your own.
                </p>
              </GiftTag>
            </div>
          </div>
        </section>
        <div aria-hidden="true" className="relative hidden h-16 lg:block">
          <div className="ribbon-band inset-0" data-axis="x" />
        </div>
      </div>

      <main>
        <section
          id="how"
          aria-labelledby="how-title"
          className="mx-auto grid max-w-6xl grid-cols-12 gap-x-6 px-4 py-20 sm:px-6 lg:py-28"
        >
          <div className="col-span-12 lg:col-span-4">
            <div className="lg:sticky lg:top-10">
              <p className={`${monoLabel} text-muted`}>How it works</p>
              <h2
                id="how-title"
                className="mt-4 font-serif text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-balance"
              >
                Four steps, <em className="italic">one</em> draw.
              </h2>
            </div>
          </div>
          <ol className="col-span-12 mt-12 border-t border-ink lg:col-span-8 lg:mt-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-5 border-b border-rule py-7 sm:grid-cols-[4.5rem_15rem_1fr] sm:gap-x-8"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-5xl leading-none text-ribbon sm:text-6xl"
                >
                  {index + 1}
                </span>
                <h3 className="font-serif text-2xl leading-tight">{step.title}</h3>
                <p className="col-start-2 mt-2 max-w-[62ch] text-muted sm:col-start-3 sm:mt-0">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div aria-hidden="true" className="ribbon-edge" />

        <section className="mx-auto grid max-w-6xl grid-cols-12 gap-x-6 px-4 py-16 sm:px-6 lg:py-20">
          <p className={`${monoLabel} col-span-12 text-muted lg:col-span-4 lg:pt-3`}>
            The privacy part
          </p>
          <p className="col-span-12 mt-4 max-w-[36ch] font-serif text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight tracking-[-0.01em] text-balance lg:col-span-8 lg:mt-0">
            Groups are private. Only people with your invite code can see or join them.
          </p>
        </section>
      </main>

      <footer className="surface-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-6 sm:px-6">
          <p className="font-serif text-xl">{SITE_NAME}</p>
          <p className={`${monoLabel} text-surface-muted`}>
            Secret Santa for friends, family and the office
          </p>
        </div>
      </footer>
    </>
  );
}
