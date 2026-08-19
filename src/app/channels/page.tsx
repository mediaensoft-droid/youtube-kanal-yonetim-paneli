import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelListClient } from "./ChannelListClient";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const [channels, categories, concepts] = await Promise.all([
    listChannels(),
    listCategories(),
    listConcepts(),
  ]);

  return <ChannelListClient initialChannels={channels} categories={categories} concepts={concepts} />;
}
