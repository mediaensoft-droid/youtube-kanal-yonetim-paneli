import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listChannels } from "@/lib/db/channels";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const channels = await listChannels(userId);

  return <CalendarClient initialChannels={channels} />;
}
