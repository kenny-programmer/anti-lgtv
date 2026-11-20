import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateGroupView } from "@/components/views/CreateGroupView";
import { DashboardView } from "@/components/views/DashboardView";
import { GroupPageView } from "@/components/views/GroupPageView";
import { JoinGroupView } from "@/components/views/JoinGroupView";
import { LotteryPreview } from "./LotteryPreview";
import { SCENES, dashboardFixture, groupFixture, isScene } from "./fixtures";

// Dev-only: renders the real page views with fixture data so the signed-in
// pages can be looked at and screenshotted without a login or a database.
export const metadata = { title: "Design preview", robots: { index: false } };

export default async function DesignPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string | string[]; t?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { scene, t } = await searchParams;
  const now = new Date();

  if (!isScene(scene)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold">Design preview</h1>
        <ul className="mt-4 space-y-1">
          {SCENES.map((name) => (
            <li key={name}>
              <Link href={`/design-preview?scene=${name}`} className="underline">
                {name}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (scene === "dashboard-empty") return <DashboardView groups={[]} now={now} />;
  if (scene === "dashboard") return <DashboardView groups={dashboardFixture(now)} now={now} />;
  if (scene === "create") return <CreateGroupView />;
  if (scene === "join") return <JoinGroupView initialCode="" />;
  if (scene === "join-prefilled") return <JoinGroupView initialCode="ABCD-1234" />;
  if (scene === "reveal-lottery") {
    const seconds = Number(typeof t === "string" ? t : 0);
    return <LotteryPreview t={Number.isFinite(seconds) ? seconds : 0} />;
  }

  const group = groupFixture(scene, now);
  if (!group) notFound();
  return <GroupPageView group={group} now={now} />;
}
