import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelForm } from "@/components/ChannelForm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function NewChannelPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const { status } = await searchParams;
  const createStatus = status === "planned" ? "planned" : "active";

  const [categories, concepts] = await Promise.all([listCategories(userId), listConcepts(userId)]);

  return (
    <div className="animate-fade-in-up mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold text-ink">
        {createStatus === "planned" ? "Planlanan Kanal Ekle" : "Kanal Ekle"}
      </h1>
      {createStatus === "planned" && (
        <p className="mb-6 text-sm text-ink-muted">
          Örnek/referans olarak takip etmek istediğin bir kanal. Kendi kanal limitine sayılmaz.
        </p>
      )}
      {createStatus === "active" && <div className="mb-6" />}
      <ChannelForm mode="create" categories={categories} concepts={concepts} createStatus={createStatus} />
    </div>
  );
}
