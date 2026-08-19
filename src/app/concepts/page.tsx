import { listConcepts, countChannelsByConcept } from "@/lib/db/concepts";
import { ConceptsClient } from "./ConceptsClient";

export const dynamic = "force-dynamic";

export default async function ConceptsPage() {
  const concepts = await listConcepts();
  const counts = await countChannelsByConcept();

  return <ConceptsClient initialConcepts={concepts} channelCounts={counts} />;
}
