import "server-only";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_THUMBNAILS = 4;

export class ContentQualityError extends Error {}

export interface ContentQualityResult {
  thumbnailScore: number | null;
  thumbnailNotes: string;
  textScore: number | null;
  textNotes: string;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mediaType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

export async function analyzeContentQuality(params: {
  channelName: string;
  description: string;
  videoTitles: string[];
  thumbnailUrls: string[];
}): Promise<ContentQualityResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ContentQualityError("ANTHROPIC_API_KEY tanımlı değil.");

  const images = (
    await Promise.all(params.thumbnailUrls.slice(0, MAX_THUMBNAILS).map(fetchImageAsBase64))
  ).filter((img): img is { data: string; mediaType: string } => img !== null);

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text:
        `YouTube kanalı: "${params.channelName}"\n\n` +
        `Kanal açıklaması:\n${params.description.slice(0, 1500)}\n\n` +
        `Son video başlıkları:\n${params.videoTitles.map((t) => `- ${t}`).join("\n")}\n\n` +
        (images.length > 0
          ? `Aşağıda bu kanalın son videolarından ${images.length} kapak görseli (thumbnail) ekli.\n\n`
          : "Kapak görseli sağlanmadı.\n\n") +
        `Görevin:\n` +
        `1) Kapak görsellerini (varsa) tıklanabilirlik/okunabilirlik/kontrast/kompozisyon açısından 1-10 arası puanla.\n` +
        `2) Video başlıklarını ve kanal açıklamasını netlik, SEO uyumu, merak uyandırma ve tutarlılık açısından 1-10 arası puanla.\n` +
        `Sadece şu JSON formatında, başka hiçbir metin eklemeden cevap ver:\n` +
        `{"thumbnailScore": <sayı|null>, "thumbnailNotes": "<1-2 cümle Türkçe değerlendirme>", "textScore": <sayı>, "textNotes": "<1-2 cümle Türkçe değerlendirme>"}`,
    },
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    })),
  ];

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ContentQualityError(`Anthropic API isteği başarısız (HTTP ${res.status}): ${text}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new ContentQualityError("Beklenmeyen yanıt formatı.");

  const parsed = JSON.parse(match[0]);
  return {
    thumbnailScore: typeof parsed.thumbnailScore === "number" ? parsed.thumbnailScore : null,
    thumbnailNotes: parsed.thumbnailNotes ?? "",
    textScore: typeof parsed.textScore === "number" ? parsed.textScore : null,
    textNotes: parsed.textNotes ?? "",
  };
}
