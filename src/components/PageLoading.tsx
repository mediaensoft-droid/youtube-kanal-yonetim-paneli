import { RefreshCw } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-sm text-ink-muted">
      <RefreshCw className="h-4 w-4 animate-spin" /> Yükleniyor...
    </div>
  );
}
