import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getChannelById } from "@/lib/db/channels";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelForm } from "@/components/ChannelForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChannelPage({ params }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const [channel, categories, concepts] = await Promise.all([
    getChannelById(userId, Number(id)),
    listCategories(userId),
    listConcepts(userId),
  ]);
  if (!channel) notFound();

  return (
    <div className="animate-fade-in-up mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Kanalı Düzenle</h1>
      <ChannelForm mode="edit" categories={categories} concepts={concepts} initialChannel={channel} />
    </div>
  );
}
