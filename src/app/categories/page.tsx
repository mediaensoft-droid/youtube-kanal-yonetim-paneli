import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { listCategories, countChannelsByCategory } from "@/lib/db/categories";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const [categories, counts] = await Promise.all([
    listCategories(userId),
    countChannelsByCategory(userId),
  ]);

  return <CategoriesClient initialCategories={categories} channelCounts={counts} />;
}
