import { listCategories } from "@/lib/db/categories";
import { listConcepts } from "@/lib/db/concepts";
import { ChannelForm } from "@/components/ChannelForm";

export const dynamic = "force-dynamic";

export default async function NewChannelPage() {
  const [categories, concepts] = await Promise.all([listCategories(), listConcepts()]);

  return (
    <div className="animate-fade-in-up mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Kanal Ekle</h1>
      <ChannelForm mode="create" categories={categories} concepts={concepts} />
    </div>
  );
}
