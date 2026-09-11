import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelListClient } from "../ChannelListClient";

export const dynamic = "force-dynamic";

// Planned = reference channels the user studies and tracks; they're not the user's own, so they
// stay out of the calendar, dashboard and the own-channel plan limit.
export default async function PlannedChannelsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [channels, categories, concepts] = await Promise.all([
    listChannels(userId, { status: "planned" }),
    listCategories(userId),
    listConcepts(userId),
  ]);

  return (
    <ChannelListClient initialChannels={channels} categories={categories} concepts={concepts} status="planned" />
  );
}
