import { listConcepts, countChannelsByConcept } from "@/lib/db/concepts";
import { ConceptsClient } from "./ConceptsClient";

export const dynamic = "force-dynamic";

export default async function ConceptsPage() {
  const [concepts, counts] = await Promise.all([listConcepts(), countChannelsByConcept()]);

  return <ConceptsClient initialConcepts={concepts} channelCounts={counts} />;
}
