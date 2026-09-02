export interface Category {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface Concept {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface Channel {
  id: number;
  youtubeId: string;
  url: string;
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  categoryId: number | null;
  conceptId: number | null;
  languages: string[];
  countries: string[];
  notes: string | null;
  publishDays: number[];
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelFilters {
  categoryId?: number;
  conceptId?: number;
  language?: string;
  country?: string;
  search?: string;
}

export interface CreateChannelInput {
  input: string;
  categoryId?: number | null;
  conceptId?: number | null;
  languages?: string[];
  countries?: string[];
  notes?: string | null;
}

export interface UpdateChannelInput {
  categoryId?: number | null;
  conceptId?: number | null;
  languages?: string[];
  countries?: string[];
  notes?: string | null;
  publishDays?: number[];
  url?: string;
}

export interface RecentVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  durationSeconds: number | null;
}

export interface ChannelDetails {
  description: string;
  publishedAt: string;
  country: string | null;
  customUrl: string | null;
  recentVideos: RecentVideo[];
}

export interface CreateCategoryInput {
  name: string;
  color: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
}

export interface CreateConceptInput {
  name: string;
  color: string;
}

export interface UpdateConceptInput {
  name?: string;
  color?: string;
}

export type ScheduleStatus = "planned" | "published" | "skipped";

export interface ScheduleEntry {
  id: number;
  channelId: number;
  date: string;
  title: string | null;
  status: ScheduleStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertScheduleEntryInput {
  channelId: number;
  date: string;
  status?: ScheduleStatus;
  title?: string | null;
  notes?: string | null;
}

export interface ChannelMonthPattern {
  id: number;
  channelId: number;
  yearMonth: string; // "YYYY-MM"
  publishDays: number[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertChannelMonthPatternInput {
  channelId: number;
  yearMonth: string;
  publishDays: number[];
}

export interface ChannelPublishCount {
  channelId: number;
  count: number;
}
