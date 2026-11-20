import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Header } from "@/components/Header";
import { HeroTag } from "@/components/HeroTag";
import { HowItWorks } from "@/components/HowItWorks";
import { ScrollLink } from "@/components/ScrollLink";
import { buttonPrimary, monoLabel, textLink } from "@/components/ui";
import { PRODUCT_NAME, SITE_NAME } from "@/lib/site";

const TICKER = [
  "Nobody draws themselves",
  "Nobody is drawn twice",
  "Only you open your tag",
  "Private by invite code",
];

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
    <div className="surface-ink wrapping-dots">
      <Header signedIn={false} />
      {/* The hero clips its sides and bottom but not its top, so the ribbon runs up
          behind the transparent header to the red top edge. */}
      <div className="hero relative overflow-x-clip [clip-path:inset(-60rem_0_0_0)]">
        <div
          aria-hidden="true"
          className="hero-shade pointer-events-none absolute inset-0 bg-black opacity-0"
        />
        <section className="relative mx-auto grid max-w-6xl grid-cols-12 gap-x-6 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:pb-28 lg:pt-20">
          <div className="col-span-12 lg:col-span-7">
            <p className={`${monoLabel} rise text-surface-muted [--d:80ms]`}>{PRODUCT_NAME}</p>
            <h1 className="hero-lift mt-6 font-serif text-[clamp(3.5rem,9vw,7rem)] font-normal leading-[0.98] tracking-[-0.02em] text-balance">
              <span className="line-mask">
                <span className="[--d:150ms]">Bunot na.</span>
              </span>{" "}
              <span className="line-mask">
                <span className="[--d:240ms]">
                  Walang <em className="italic">atrasan</em>.
                </span>
              </span>
            </h1>
            <p className="rise mt-8 max-w-[36rem] text-lg leading-relaxed text-pretty text-surface-muted [--d:420ms]">
              Start a private group and hand out the invite code. When signups close, the organizer
              draws the names once, and everyone opens only their own tag. Nobody draws themselves.
              Nobody is drawn twice.
            </p>
            <p className="rise mt-6 flex max-w-[36rem] items-baseline gap-4 font-serif text-xl leading-snug italic text-surface [--d:480ms]">
              <span
                aria-hidden="true"
                className="h-px w-8 shrink-0 translate-y-[-0.3em] bg-ribbon"
              />
              <span>BAWASE NAMAN ANG PATAS PANAY TRABAHO NALANG</span>
            </p>
            <div className="rise mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 [--d:560ms]">
              <a href="/sign-in" className={buttonPrimary}>
                Sign in with Google
              </a>
              <ScrollLink href="#how" focusId="how-title" className={`group ${textLink}`}>
                How the draw works
                <span
                  aria-hidden="true"
                  className="no-underline transition-quick group-hover:translate-y-0.5"
                >
                  &darr;
                </span>
              </ScrollLink>
            </div>
          </div>

          <div className="relative col-span-12 mt-16 lg:col-span-5 lg:mt-0">
            {/* Small screens: the tag assembly hangs from a horizontal band. */}
            <div
              aria-hidden="true"
              className="ribbon-band wipe-x -left-[50vw] -right-[50vw] top-0 z-10 h-12 lg:hidden"
              data-axis="x"
            />
            <HeroTag />
          </div>
        </section>
        {/* The bottom ribbon doubles as a slow ticker. Decorative: every line on it is
            also said in the copy above and below. */}
        <div aria-hidden="true" className="relative h-14 lg:h-16">
          <div className="ribbon-band wipe-x ticker inset-0" data-axis="x">
            <div className="ticker-track h-full items-center">
              {[0, 1].map((copy) =>
                TICKER.map((line) => (
                  <span
                    key={`${copy}-${line}`}
                    className="flex items-center whitespace-nowrap font-serif text-[1.3rem] italic text-cream"
                  >
                    <span className="px-7">{line}</span>
                    <span className="font-mono text-sm not-italic">/</span>
                  </span>
                )),
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="surface-paper">
        <HowItWorks steps={STEPS} />

        <div aria-hidden="true" className="ribbon-edge" />

        <section className="mx-auto grid max-w-6xl grid-cols-12 gap-x-6 px-4 py-16 sm:px-6 lg:py-20">
          <p
            className={`${monoLabel} reveal-on-scroll col-span-12 text-muted lg:col-span-4 lg:pt-3`}
          >
            The privacy part
          </p>
          <p className="reveal-on-scroll col-span-12 mt-4 max-w-[36ch] font-serif text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight tracking-[-0.01em] text-balance lg:col-span-8 lg:mt-0">
            Groups are private. Only people with your invite code can see or join them.
          </p>
        </section>
      </main>

      <footer className="bg-ink">
        <div className="reveal-on-scroll mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-6 sm:px-6">
          <p className="font-serif text-xl">{SITE_NAME}</p>
          <p className={`${monoLabel} text-surface-muted`}>
            {PRODUCT_NAME} for friends, family and the office
          </p>
        </div>
      </footer>
    </div>
  );
}
