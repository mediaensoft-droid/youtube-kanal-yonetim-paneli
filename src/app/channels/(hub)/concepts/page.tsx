import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listConcepts, countChannelsByConcept } from "@/lib/db/concepts";
import { ConceptsClient } from "./ConceptsClient";

export const dynamic = "force-dynamic";

export default async function ConceptsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [concepts, counts] = await Promise.all([
    listConcepts(userId),
    countChannelsByConcept(userId),
  ]);

  return <ConceptsClient initialConcepts={concepts} channelCounts={counts} />;
}
