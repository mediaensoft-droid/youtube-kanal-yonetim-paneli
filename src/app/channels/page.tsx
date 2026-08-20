import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelListClient } from "./ChannelListClient";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [channels, categories, concepts] = await Promise.all([
    listChannels(userId),
    listCategories(userId),
    listConcepts(userId),
  ]);

  return <ChannelListClient initialChannels={channels} categories={categories} concepts={concepts} />;
}
