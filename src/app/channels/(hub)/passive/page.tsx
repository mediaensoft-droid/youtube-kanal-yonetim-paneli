import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelListClient } from "../ChannelListClient";

export const dynamic = "force-dynamic";

// Passive channels are hidden from every other screen (calendar, dashboard, counts); this is the
// only place they're listed, so the user can find and reactivate them.
export default async function PassiveChannelsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [channels, categories, concepts] = await Promise.all([
    listChannels(userId, { status: "passive" }),
    listCategories(userId),
    listConcepts(userId),
  ]);

  return (
    <ChannelListClient initialChannels={channels} categories={categories} concepts={concepts} status="passive" />
  );
}
