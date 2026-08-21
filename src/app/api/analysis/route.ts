import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { hasUltraAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export interface ChannelAnalysisResult {
  channelName: string;
  targetAgeGroup: string;
  targetCountry: string;
  thumbnailQuality: string;
  textQuality: string;
  audienceFit: string;
  languageGaps: string[];
  rpm: number | null;
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
  if (!(await hasUltraAccess(userId))) {
    return errorResponse(403, "Bu özellik yalnızca Ultra plan için geçerli.");
  }

  const json = await req.json().catch(() => null);
  const url = typeof json?.url === "string" ? json.url.trim() : "";
  if (!url) return errorResponse(400, "Kanal linki gerekli.");

  if (!process.env.NEXLEV_API_KEY) {
    return errorResponse(
      503,
      "Kanal analiz özelliği henüz aktif değil — NexLev entegrasyonu yapılandırma aşamasında."
    );
  }

  // NexLev API entegrasyonu buraya eklenecek (NEXLEV_API_KEY hazır olduğunda).
  return errorResponse(501, "NexLev entegrasyonu henüz uygulanmadı.");
}
