import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { countChannelsByStatus } from "@/lib/db/channels";
import { ChannelsTabs } from "./ChannelsTabs";
import { HubAddButton } from "./HubAddButton";

export const dynamic = "force-dynamic";

// Shared frame for the Kanallar hub (/channels, /channels/passive, /channels/planned,
// /channels/categories, /channels/concepts): one title, one add button, and the tab strip. The
// (hub) route group keeps /channels/new and /channels/[id] out of it — those are focused
// single-purpose pages.
export default async function ChannelsHubLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [passiveCount, plannedCount] = await Promise.all([
    countChannelsByStatus(userId, "passive"),
    countChannelsByStatus(userId, "planned"),
  ]);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink">Kanallar</h1>
        <HubAddButton />
      </div>

      <ChannelsTabs passiveCount={passiveCount} plannedCount={plannedCount} />

      {children}
    </div>
  );
}
