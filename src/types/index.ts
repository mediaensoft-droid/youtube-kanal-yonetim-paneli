import type { ActivityAction } from "@/lib/activity";

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

/**
 * active  — the user's own channel, shown everywhere.
 * passive — the user's own channel, parked: hidden from calendar/dashboard/counts.
 * planned — a reference channel the user tracks as an example; never counted as their own.
 */
export type ChannelStatus = "active" | "passive" | "planned";

export type ChannelStatusFilter = ChannelStatus | "all";

export interface Channel {
  id: number;
  youtubeId: string;
  url: string;
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  categoryIds: number[];
  conceptIds: number[];
  languages: string[];
  countries: string[];
  notes: string | null;
  publishDays: number[];
  publishTime: string | null;
  status: ChannelStatus;
  createdByMemberId: number | null;
  statusChangedByMemberId: number | null;
  statusChangedAt: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface ChannelFilters {
  /** Defaults to "active" — passive channels only show up where explicitly requested. */
  status?: ChannelStatusFilter;
  categoryId?: number;
  conceptId?: number;
  language?: string;
  country?: string;
  search?: string;
}

export interface CreateChannelInput {
  input: string;
  categoryIds?: number[];
  conceptIds?: number[];
  languages?: string[];
  countries?: string[];
  notes?: string | null;
}

export interface UpdateChannelInput {
  categoryIds?: number[];
  conceptIds?: number[];
  languages?: string[];
  countries?: string[];
  notes?: string | null;
  publishDays?: number[];
  publishTime?: string | null;
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
  publishedAt: string | null;
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

export type ActivityEntityType = "channel" | "category" | "concept" | "schedule" | "member" | "auth" | "task";

export interface ActivityItem {
  id: number;
  memberId: number | null;
  /** Live join on members.displayName — null when the actor was removed since. */
  memberName: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: number | null;
  entityName: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface TaskColumn {
  id: number;
  name: string;
  position: number;
  isDone: boolean;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type TaskPriority = "low" | "normal" | "high";

export interface Task {
  id: number;
  columnId: number;
  title: string;
  description: string | null;
  assigneeMemberId: number | null;
  channelId: number | null;
  dueDate: string | null;
  priority: TaskPriority;
  position: number;
  checklist: ChecklistItem[];
  createdByMemberId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  memberId: number | null;
  memberName: string | null;
  body: string;
  createdAt: string;
}

