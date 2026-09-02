import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { VideoCountsClient } from "./VideoCountsClient";

export const dynamic = "force-dynamic";

export default async function VideoCountsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [channels, categories, concepts] = await Promise.all([
    listChannels(userId),
    listCategories(userId),
    listConcepts(userId),
  ]);

  return <VideoCountsClient channels={channels} categories={categories} concepts={concepts} />;
}
