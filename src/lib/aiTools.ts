// Pure module — no "server-only", no DB access. Shared catalog of AI tools a channel can be tagged
// with (E). Logos come from Google's public favicon proxy, keyed by domain; MultiSelect/ChannelForm,
// ChannelAiToolLogos and the channel detail page all read from here.

export interface AiToolCategory {
  id: string;
  label: string;
}

export interface AiTool {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
}

export const AI_TOOL_CATEGORIES: AiToolCategory[] = [
  { id: "video-uretimi", label: "Video üretimi" },
  { id: "avatar-sunucu", label: "Avatar / sunucu" },
  { id: "gorsel-uretimi", label: "Görsel üretimi" },
  { id: "seslendirme-tts", label: "Seslendirme / TTS" },
  { id: "muzik-ses-efekti", label: "Müzik / ses efekti" },
  { id: "senaryo-metin-llm", label: "Senaryo / metin (LLM)" },
  { id: "kurgu-duzenleme", label: "Kurgu / düzenleme" },
  { id: "altyazi-ceviri-dublaj", label: "Altyazı / çeviri / dublaj" },
  { id: "kucuk-resim-tasarim", label: "Küçük resim / tasarım" },
  { id: "arastirma-seo-analiz", label: "Araştırma / SEO / analiz" },
  { id: "otomasyon", label: "Otomasyon" },
];

// Same real-world tool can show up under more than one category (e.g. Canva, Ideogram, HeyGen) —
// each placement is its own catalog entry with its own unique id, per the design doc.
export const AI_TOOLS: AiTool[] = [
  // Video üretimi
  { id: "runway", name: "Runway", url: "https://runwayml.com", domain: "runwayml.com", category: "video-uretimi" },
  { id: "pika", name: "Pika", url: "https://pika.art", domain: "pika.art", category: "video-uretimi" },
  { id: "luma-dream-machine", name: "Luma Dream Machine", url: "https://lumalabs.ai", domain: "lumalabs.ai", category: "video-uretimi" },
  { id: "kling", name: "Kling", url: "https://klingai.com", domain: "klingai.com", category: "video-uretimi" },
  { id: "sora", name: "Sora", url: "https://openai.com", domain: "openai.com", category: "video-uretimi" },
  { id: "google-veo", name: "Google Veo", url: "https://deepmind.google", domain: "deepmind.google", category: "video-uretimi" },
  { id: "hailuo", name: "Hailuo", url: "https://hailuoai.video", domain: "hailuoai.video", category: "video-uretimi" },
  { id: "vidu", name: "Vidu", url: "https://vidu.com", domain: "vidu.com", category: "video-uretimi" },
  { id: "higgsfield", name: "Higgsfield", url: "https://higgsfield.ai", domain: "higgsfield.ai", category: "video-uretimi" },
  { id: "hedra", name: "Hedra", url: "https://hedra.com", domain: "hedra.com", category: "video-uretimi" },
  { id: "invideo-ai", name: "InVideo AI", url: "https://invideo.io", domain: "invideo.io", category: "video-uretimi" },
  { id: "pictory", name: "Pictory", url: "https://pictory.ai", domain: "pictory.ai", category: "video-uretimi" },
  { id: "fliki", name: "Fliki", url: "https://fliki.ai", domain: "fliki.ai", category: "video-uretimi" },

  // Avatar / sunucu
  { id: "heygen", name: "HeyGen", url: "https://heygen.com", domain: "heygen.com", category: "avatar-sunucu" },
  { id: "synthesia", name: "Synthesia", url: "https://synthesia.io", domain: "synthesia.io", category: "avatar-sunucu" },
  { id: "d-id", name: "D-ID", url: "https://d-id.com", domain: "d-id.com", category: "avatar-sunucu" },
  { id: "captions", name: "Captions", url: "https://captions.ai", domain: "captions.ai", category: "avatar-sunucu" },

  // Görsel üretimi
  { id: "midjourney", name: "Midjourney", url: "https://midjourney.com", domain: "midjourney.com", category: "gorsel-uretimi" },
  { id: "chatgpt-images", name: "ChatGPT Images / DALL·E", url: "https://openai.com", domain: "openai.com", category: "gorsel-uretimi" },
  { id: "stable-diffusion", name: "Stable Diffusion", url: "https://stability.ai", domain: "stability.ai", category: "gorsel-uretimi" },
  { id: "leonardo-ai", name: "Leonardo AI", url: "https://leonardo.ai", domain: "leonardo.ai", category: "gorsel-uretimi" },
  { id: "ideogram", name: "Ideogram", url: "https://ideogram.ai", domain: "ideogram.ai", category: "gorsel-uretimi" },
  { id: "adobe-firefly", name: "Adobe Firefly", url: "https://firefly.adobe.com", domain: "firefly.adobe.com", category: "gorsel-uretimi" },
  { id: "flux", name: "Flux", url: "https://bfl.ai", domain: "bfl.ai", category: "gorsel-uretimi" },
  { id: "krea", name: "Krea", url: "https://krea.ai", domain: "krea.ai", category: "gorsel-uretimi" },
  { id: "recraft", name: "Recraft", url: "https://recraft.ai", domain: "recraft.ai", category: "gorsel-uretimi" },
  { id: "freepik-ai", name: "Freepik AI", url: "https://freepik.com", domain: "freepik.com", category: "gorsel-uretimi" },
  { id: "canva", name: "Canva", url: "https://canva.com", domain: "canva.com", category: "gorsel-uretimi" },

  // Seslendirme / TTS
  { id: "elevenlabs", name: "ElevenLabs", url: "https://elevenlabs.io", domain: "elevenlabs.io", category: "seslendirme-tts" },
  { id: "murf", name: "Murf", url: "https://murf.ai", domain: "murf.ai", category: "seslendirme-tts" },
  { id: "play-ht", name: "Play.ht", url: "https://play.ht", domain: "play.ht", category: "seslendirme-tts" },
  { id: "speechify", name: "Speechify", url: "https://speechify.com", domain: "speechify.com", category: "seslendirme-tts" },
  { id: "fish-audio", name: "Fish Audio", url: "https://fish.audio", domain: "fish.audio", category: "seslendirme-tts" },
  { id: "resemble-ai", name: "Resemble AI", url: "https://resemble.ai", domain: "resemble.ai", category: "seslendirme-tts" },
  { id: "wellsaid", name: "WellSaid", url: "https://wellsaidlabs.com", domain: "wellsaidlabs.com", category: "seslendirme-tts" },
  { id: "google-cloud-tts", name: "Google Cloud TTS", url: "https://cloud.google.com", domain: "cloud.google.com", category: "seslendirme-tts" },
  { id: "azure-speech", name: "Azure Speech", url: "https://azure.microsoft.com", domain: "azure.microsoft.com", category: "seslendirme-tts" },
  { id: "openai-tts", name: "OpenAI TTS", url: "https://openai.com", domain: "openai.com", category: "seslendirme-tts" },

  // Müzik / ses efekti
  { id: "suno", name: "Suno", url: "https://suno.com", domain: "suno.com", category: "muzik-ses-efekti" },
  { id: "udio", name: "Udio", url: "https://udio.com", domain: "udio.com", category: "muzik-ses-efekti" },
  { id: "aiva", name: "AIVA", url: "https://aiva.ai", domain: "aiva.ai", category: "muzik-ses-efekti" },
  { id: "soundraw", name: "Soundraw", url: "https://soundraw.io", domain: "soundraw.io", category: "muzik-ses-efekti" },
  { id: "mubert", name: "Mubert", url: "https://mubert.com", domain: "mubert.com", category: "muzik-ses-efekti" },
  { id: "stable-audio", name: "Stable Audio", url: "https://stableaudio.com", domain: "stableaudio.com", category: "muzik-ses-efekti" },

  // Senaryo / metin (LLM)
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com", domain: "chatgpt.com", category: "senaryo-metin-llm" },
  { id: "claude", name: "Claude", url: "https://claude.ai", domain: "claude.ai", category: "senaryo-metin-llm" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com", domain: "gemini.google.com", category: "senaryo-metin-llm" },
  { id: "perplexity", name: "Perplexity", url: "https://perplexity.ai", domain: "perplexity.ai", category: "senaryo-metin-llm" },
  { id: "grok", name: "Grok", url: "https://grok.com", domain: "grok.com", category: "senaryo-metin-llm" },
  { id: "deepseek", name: "DeepSeek", url: "https://deepseek.com", domain: "deepseek.com", category: "senaryo-metin-llm" },
  { id: "microsoft-copilot", name: "Microsoft Copilot", url: "https://copilot.microsoft.com", domain: "copilot.microsoft.com", category: "senaryo-metin-llm" },
  { id: "jasper", name: "Jasper", url: "https://jasper.ai", domain: "jasper.ai", category: "senaryo-metin-llm" },
  { id: "notion-ai", name: "Notion AI", url: "https://notion.so", domain: "notion.so", category: "senaryo-metin-llm" },

  // Kurgu / düzenleme
  { id: "capcut", name: "CapCut", url: "https://capcut.com", domain: "capcut.com", category: "kurgu-duzenleme" },
  { id: "descript", name: "Descript", url: "https://descript.com", domain: "descript.com", category: "kurgu-duzenleme" },
  { id: "adobe-premiere-pro", name: "Adobe Premiere Pro", url: "https://adobe.com", domain: "adobe.com", category: "kurgu-duzenleme" },
  { id: "davinci-resolve", name: "DaVinci Resolve", url: "https://blackmagicdesign.com", domain: "blackmagicdesign.com", category: "kurgu-duzenleme" },
  { id: "opus-clip", name: "Opus Clip", url: "https://opus.pro", domain: "opus.pro", category: "kurgu-duzenleme" },
  { id: "veed", name: "VEED", url: "https://veed.io", domain: "veed.io", category: "kurgu-duzenleme" },
  { id: "kapwing", name: "Kapwing", url: "https://kapwing.com", domain: "kapwing.com", category: "kurgu-duzenleme" },
  { id: "filmora", name: "Filmora", url: "https://filmora.wondershare.com", domain: "filmora.wondershare.com", category: "kurgu-duzenleme" },
  { id: "submagic", name: "Submagic", url: "https://submagic.co", domain: "submagic.co", category: "kurgu-duzenleme" },
  { id: "vizard", name: "Vizard", url: "https://vizard.ai", domain: "vizard.ai", category: "kurgu-duzenleme" },
  { id: "remotion", name: "Remotion", url: "https://remotion.dev", domain: "remotion.dev", category: "kurgu-duzenleme" },

  // Altyazı / çeviri / dublaj
  { id: "whisper", name: "Whisper", url: "https://openai.com", domain: "openai.com", category: "altyazi-ceviri-dublaj" },
  { id: "deepl", name: "DeepL", url: "https://deepl.com", domain: "deepl.com", category: "altyazi-ceviri-dublaj" },
  { id: "rask-ai", name: "Rask AI", url: "https://rask.ai", domain: "rask.ai", category: "altyazi-ceviri-dublaj" },
  { id: "elevenlabs-dubbing", name: "ElevenLabs Dubbing", url: "https://elevenlabs.io", domain: "elevenlabs.io", category: "altyazi-ceviri-dublaj" },
  { id: "heygen-translate", name: "HeyGen Translate", url: "https://heygen.com", domain: "heygen.com", category: "altyazi-ceviri-dublaj" },

  // Küçük resim / tasarım
  { id: "canva-thumbnail", name: "Canva", url: "https://canva.com", domain: "canva.com", category: "kucuk-resim-tasarim" },
  { id: "adobe-photoshop", name: "Adobe Photoshop", url: "https://adobe.com", domain: "adobe.com", category: "kucuk-resim-tasarim" },
  { id: "thumbnail-ai", name: "Thumbnail AI", url: "https://thumbnail.ai", domain: "thumbnail.ai", category: "kucuk-resim-tasarim" },
  { id: "ideogram-thumbnail", name: "Ideogram", url: "https://ideogram.ai", domain: "ideogram.ai", category: "kucuk-resim-tasarim" },

  // Araştırma / SEO / analiz
  { id: "vidiq", name: "vidIQ", url: "https://vidiq.com", domain: "vidiq.com", category: "arastirma-seo-analiz" },
  { id: "tubebuddy", name: "TubeBuddy", url: "https://tubebuddy.com", domain: "tubebuddy.com", category: "arastirma-seo-analiz" },
  { id: "nexlev", name: "NexLev", url: "https://nexlev.io", domain: "nexlev.io", category: "arastirma-seo-analiz" },
  { id: "gling", name: "Gling", url: "https://gling.ai", domain: "gling.ai", category: "arastirma-seo-analiz" },
  { id: "google-trends", name: "Google Trends", url: "https://trends.google.com", domain: "trends.google.com", category: "arastirma-seo-analiz" },

  // Otomasyon
  { id: "make", name: "Make", url: "https://make.com", domain: "make.com", category: "otomasyon" },
  { id: "n8n", name: "n8n", url: "https://n8n.io", domain: "n8n.io", category: "otomasyon" },
  { id: "zapier", name: "Zapier", url: "https://zapier.com", domain: "zapier.com", category: "otomasyon" },
];

export const AI_TOOL_IDS: Set<string> = new Set(AI_TOOLS.map((t) => t.id));

const AI_TOOLS_BY_ID = new Map(AI_TOOLS.map((t) => [t.id, t]));

export function getAiTool(id: string): AiTool | undefined {
  return AI_TOOLS_BY_ID.get(id);
}

export function toolLogoUrl(tool: AiTool): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${tool.domain}`;
}
