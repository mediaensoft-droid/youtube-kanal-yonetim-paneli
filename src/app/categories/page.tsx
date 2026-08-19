import { listCategories, countChannelsByCategory } from "@/lib/db/categories";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, counts] = await Promise.all([listCategories(), countChannelsByCategory()]);

  return <CategoriesClient initialCategories={categories} channelCounts={counts} />;
}
