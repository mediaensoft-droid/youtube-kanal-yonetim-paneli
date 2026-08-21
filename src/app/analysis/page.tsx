import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { hasUltraAccess } from "@/lib/access";
import { AnalysisForm } from "@/components/analysis/AnalysisForm";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const allowed = await hasUltraAccess(userId);

  return (
    <div className="animate-fade-in-up mx-auto max-w-5xl">
      <h1 className="mb-2 text-2xl font-semibold text-ink">Kanal Analizi</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Bir YouTube kanal linki yapıştırın; hedef kitle, kapak/metin kalitesi, dil boşlukları ve RPM
        gibi verileri tabloda görün.
      </p>

      {allowed ? (
        <AnalysisForm />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-10 text-center">
          <Lock className="h-6 w-6 text-ink-faint" />
          <p className="text-sm text-ink-muted">Bu özellik yalnızca Ultra plan üyelerine açıktır.</p>
          <Link
            href="/billing"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-hover active:scale-[0.97]"
          >
            Ultra plana geç
          </Link>
        </div>
      )}
    </div>
  );
}
