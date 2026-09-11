import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { countPassiveChannelsForUser } from "@/lib/db/channels";
import { Button } from "@/components/ui/Button";
import { ChannelsTabs } from "./ChannelsTabs";

export const dynamic = "force-dynamic";

// Shared frame for the Kanallar hub (/channels, /channels/passive, /channels/categories,
// /channels/concepts): one title, one "Kanal Ekle" button, and the tab strip. The (hub) route
// group keeps /channels/new and /channels/[id] out of it — those are focused single-purpose pages.
export default async function ChannelsHubLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const passiveCount = await countPassiveChannelsForUser(userId);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink">Kanallar</h1>
        <Link href="/channels/new">
          <Button>
            <Plus className="h-4 w-4" /> Kanal Ekle
          </Button>
        </Link>
      </div>

      <ChannelsTabs passiveCount={passiveCount} />

      {children}
    </div>
  );
}
