import { listCategories, countChannelsByCategory } from "@/lib/db/categories";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategories();
  const counts = await countChannelsByCategory();

  return <CategoriesClient initialCategories={categories} channelCounts={counts} />;
}
