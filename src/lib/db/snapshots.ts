import "server-only";
import { all, run } from "@/lib/db";

export interface ChannelSnapshot {
  id: number;
  channelId: number;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  capturedAt: string;
}

export interface CreateSnapshotInput {
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
}

export async function createSnapshot(channelId: number, input: CreateSnapshotInput): Promise<void> {
  await run(
    `INSERT INTO channel_snapshots (channelId, subscriberCount, videoCount, viewCount) VALUES (?, ?, ?, ?)`,
    [channelId, input.subscriberCount, input.videoCount, input.viewCount]
  );
}

export async function listSnapshots(channelId: number): Promise<ChannelSnapshot[]> {
  return all<ChannelSnapshot>(
    `SELECT * FROM channel_snapshots WHERE channelId = ? ORDER BY capturedAt ASC`,
    [channelId]
  );
}
