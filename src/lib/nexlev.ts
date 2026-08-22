import "server-only";

const BASE_URL = "https://prod.dashboard.nexlev.io/api";

export class NexlevApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "NexlevApiError";
  }
}

async function nexlevRequest<T>(
  method: "GET" | "POST",
  path: string,
  options: { query?: Record<string, string>; body?: Record<string, unknown> } = {}
): Promise<T> {
  const apiKey = process.env.NEXLEV_API_KEY;
  if (!apiKey) throw new Error("NEXLEV_API_KEY tanımlı değil.");

  const url = new URL(`${BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    method,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NexlevApiError(`NexLev isteği başarısız (HTTP ${res.status}): ${text}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface NexlevChannelAbout {
  channelId: string;
  title: string;
  description: string;
}

export async function getChannelAbout(channelId: string): Promise<NexlevChannelAbout> {
  return nexlevRequest<NexlevChannelAbout>("GET", "/external/channels/about", {
    query: { id: channelId },
  });
}

export interface NexlevGeoDemoRev {
  category: string;
  rpm: { rpm_15: number; rpm_45: number; rpm_45_plus: number };
  demographics: {
    gender: Record<string, number>;
    age: Record<string, number>;
    viewership_country: Record<string, number>;
  };
  revenue: {
    channel_language_code: string;
    month_revenue: number;
    month_long_revenue: number;
    month_short_revenue: number;
    [key: string]: unknown;
  };
}

export async function getGeoDemoRev(channelId: string): Promise<NexlevGeoDemoRev> {
  return nexlevRequest<NexlevGeoDemoRev>("POST", "/external/analytics/channel-analytics/geography-revenue", {
    body: { channelId },
  });
}

export interface NexlevAnalysisJobCreate {
  job_id: string;
  channel_id: string;
  cached: boolean;
}

export async function createChannelAnalysisJob(channelId: string): Promise<NexlevAnalysisJobCreate> {
  return nexlevRequest<NexlevAnalysisJobCreate>("GET", "/external/channels/analysis/job/create", {
    query: { channel_id: channelId },
  });
}

export interface NexlevAnalysisJobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: {
    strategic_insights?: {
      audience_insights?: {
        sentiment_summary?: {
          overall_sentiment?: string;
          engagement_level?: string;
        };
      };
    };
  };
}

export async function getChannelAnalysisJobStatus(jobId: string): Promise<NexlevAnalysisJobStatus> {
  return nexlevRequest<NexlevAnalysisJobStatus>("GET", "/external/channels/analysis/job/status", {
    query: { job_id: jobId },
  });
}

const COUNTRY_LANGUAGE: Record<string, string> = {
  "United States": "eng",
  "United Kingdom": "eng",
  Canada: "eng",
  Australia: "eng",
  India: "hin",
  Brazil: "por",
  Mexico: "spa",
  Spain: "spa",
  Germany: "deu",
  France: "fra",
  Turkey: "tur",
  Japan: "jpn",
  "South Korea": "kor",
  Indonesia: "ind",
  Russia: "rus",
  Italy: "ita",
  Netherlands: "nld",
  Poland: "pol",
  Vietnam: "vie",
  Thailand: "tha",
  "Saudi Arabia": "ara",
  Egypt: "ara",
};

/** Largest key by value in a percentage-map (e.g. demographics.age / viewership_country). */
function topEntry(map: Record<string, number>): [string, number] | undefined {
  const entries = Object.entries(map);
  if (entries.length === 0) return undefined;
  return entries.reduce((max, entry) => (entry[1] > max[1] ? entry : max));
}

const AGE_LABELS: Record<string, string> = {
  "13_17_years": "13-17 yaş",
  "18_24_years": "18-24 yaş",
  "25_34_years": "25-34 yaş",
  "35_44_years": "35-44 yaş",
  "45_54_years": "45-54 yaş",
  "55_64_years": "55-64 yaş",
  "65_plus_years": "65+ yaş",
};

export function formatTopAgeGroup(age: Record<string, number>): string {
  const top = topEntry(age);
  if (!top) return "—";
  return `${AGE_LABELS[top[0]] ?? top[0]} (%${top[1].toFixed(1)})`;
}

export function formatTopCountry(countries: Record<string, number>): string {
  const top = topEntry(countries);
  if (!top) return "—";
  return `${top[0]} (%${top[1].toFixed(1)})`;
}

/** Heuristic: flag a language gap when a large, non-channel-language viewer segment exists. */
export function detectLanguageGap(
  channelLanguageCode: string,
  countries: Record<string, number>
): string[] {
  const gaps: string[] = [];
  for (const [country, share] of Object.entries(countries)) {
    if (share < 12) continue;
    const lang = COUNTRY_LANGUAGE[country];
    if (lang && lang !== channelLanguageCode) {
      gaps.push(`${country} (%${share.toFixed(1)})`);
    }
  }
  return gaps;
}
