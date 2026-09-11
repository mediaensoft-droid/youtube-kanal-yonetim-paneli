import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { can } from "@/lib/roles";
import { listChannels } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");
  const userId = actor.workspaceId;

  const [channels, categories, concepts] = await Promise.all([
    listChannels(userId),
    listCategories(userId),
    listConcepts(userId),
  ]);

  return (
    <CalendarClient
      initialChannels={channels}
      categories={categories}
      concepts={concepts}
      readOnly={!can(actor.role, "schedule.write")}
    />
  );
}
