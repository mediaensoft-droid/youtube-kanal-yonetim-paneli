import "server-only";
import { all, get, run } from "@/lib/db";

export type ConversationType = "general" | "dm";

export interface Conversation {
  id: number;
  type: ConversationType;
  memberAId: number | null;
  memberBId: number | null;
  createdAt: string;
}

const CONVERSATION_COLUMNS = "id, type, memberAId, memberBId, createdAt";

export async function getConversationById(userId: number, id: number): Promise<Conversation | undefined> {
  return get<Conversation>(
    `SELECT ${CONVERSATION_COLUMNS} FROM conversations WHERE id = ? AND userId = ?`,
    [id, userId]
  );
}

/** Every workspace has exactly one 'general' conversation, created lazily on first visit. */
export async function ensureGeneralConversation(userId: number): Promise<Conversation> {
  const existing = await get<Conversation>(
    `SELECT ${CONVERSATION_COLUMNS} FROM conversations WHERE userId = ? AND type = 'general'`,
    [userId]
  );
  if (existing) return existing;
  const result = await run(`INSERT INTO conversations (userId, type) VALUES (?, 'general')`, [userId]);
  return (await getConversationById(userId, result.lastInsertRowid))!;
}

/** Gets or creates the 1:1 conversation between two members — the pair is stored sorted
 * (memberAId < memberBId) so the caller order never produces a duplicate row. */
export async function getOrCreateDm(userId: number, memberX: number, memberY: number): Promise<Conversation> {
  const memberAId = Math.min(memberX, memberY);
  const memberBId = Math.max(memberX, memberY);
  const existing = await get<Conversation>(
    `SELECT ${CONVERSATION_COLUMNS} FROM conversations
      WHERE userId = ? AND type = 'dm' AND memberAId = ? AND memberBId = ?`,
    [userId, memberAId, memberBId]
  );
  if (existing) return existing;
  const result = await run(
    `INSERT INTO conversations (userId, type, memberAId, memberBId) VALUES (?, 'dm', ?, ?)`,
    [userId, memberAId, memberBId]
  );
  return (await getConversationById(userId, result.lastInsertRowid))!;
}

/** A general conversation is shared by the whole workspace; a DM only by its two members. */
export function isParticipant(conversation: Conversation, memberId: number): boolean {
  if (conversation.type === "general") return true;
  return conversation.memberAId === memberId || conversation.memberBId === memberId;
}

export interface DmSummary {
  conversationId: number;
  otherMemberId: number | null;
  lastMessageAt: string | null;
}

export interface ConversationsForMember {
  general: Conversation;
  dms: DmSummary[];
}

/** The general conversation plus every DM this member is part of, each with its last activity
 * timestamp (null when nobody has sent a message yet). */
export async function listConversationsForMember(
  userId: number,
  memberId: number
): Promise<ConversationsForMember> {
  const general = await ensureGeneralConversation(userId);
  const rows = await all<{ id: number; memberAId: number | null; memberBId: number | null; lastMessageAt: string | null }>(
    `SELECT c.id, c.memberAId, c.memberBId,
            (SELECT MAX(m.createdAt) FROM messages m WHERE m.conversationId = c.id) AS lastMessageAt
       FROM conversations c
      WHERE c.userId = ? AND c.type = 'dm' AND (c.memberAId = ? OR c.memberBId = ?)`,
    [userId, memberId, memberId]
  );
  const dms = rows.map((row) => ({
    conversationId: row.id,
    otherMemberId: row.memberAId === memberId ? row.memberBId : row.memberAId,
    lastMessageAt: row.lastMessageAt,
  }));
  return { general, dms };
}

/** Unread message count per conversation this member participates in: messages strictly newer
 * than their read cursor (or all of them, if they've never read the conversation) that weren't
 * sent by the member themselves. */
export async function unreadCountsForMember(userId: number, memberId: number): Promise<Record<number, number>> {
  const rows = await all<{ conversationId: number; count: number }>(
    `SELECT m.conversationId AS conversationId, COUNT(*) AS count
       FROM messages m
       JOIN conversations c ON c.id = m.conversationId AND c.userId = ?
       LEFT JOIN conversation_reads r ON r.conversationId = m.conversationId AND r.memberId = ?
      WHERE (c.type = 'general' OR c.memberAId = ? OR c.memberBId = ?)
        AND (m.memberId IS NULL OR m.memberId != ?)
        AND m.id > COALESCE(r.lastReadMessageId, 0)
      GROUP BY m.conversationId`,
    [userId, memberId, memberId, memberId, memberId]
  );
  const counts: Record<number, number> = {};
  for (const row of rows) counts[row.conversationId] = row.count;
  return counts;
}

export interface MessageRow {
  id: number;
  conversationId: number;
  memberId: number | null;
  memberName: string | null;
  body: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  attachmentType: string | null;
  createdAt: string;
}

const MESSAGE_COLUMNS = `
  m.id, m.conversationId, m.memberId, mem.displayName AS memberName, m.body,
  m.attachmentUrl, m.attachmentName, m.attachmentSize, m.attachmentType, m.createdAt
`;

export interface ListMessagesOptions {
  after?: number;
  before?: number;
  limit?: number;
}

/** `after`/`before` page by message id (never both at once in practice). Results are always
 * returned oldest-first, even when paging backwards with `before` (which queries newest-first
 * internally to get the right page, then reverses it). */
export async function listMessages(
  userId: number,
  conversationId: number,
  options: ListMessagesOptions = {}
): Promise<MessageRow[]> {
  const limit = options.limit ?? 50;
  const conditions = ["m.conversationId = ?", "c.userId = ?"];
  const params: (string | number)[] = [conversationId, userId];
  if (options.after !== undefined) {
    conditions.push("m.id > ?");
    params.push(options.after);
  }
  if (options.before !== undefined) {
    conditions.push("m.id < ?");
    params.push(options.before);
  }
  const pagingBackwards = options.before !== undefined;
  const order = pagingBackwards ? "DESC" : "ASC";

  const rows = await all<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS}
       FROM messages m
       JOIN conversations c ON c.id = m.conversationId
       LEFT JOIN members mem ON mem.id = m.memberId
      WHERE ${conditions.join(" AND ")}
      ORDER BY m.id ${order}
      LIMIT ?`,
    [...params, limit]
  );
  return pagingBackwards ? rows.reverse() : rows;
}

export interface CreateMessageAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface CreateMessageInput {
  body: string;
  attachment?: CreateMessageAttachment;
}

export async function createMessage(
  userId: number,
  conversationId: number,
  memberId: number,
  input: CreateMessageInput
): Promise<MessageRow> {
  const result = await run(
    `INSERT INTO messages (conversationId, memberId, body, attachmentUrl, attachmentName, attachmentSize, attachmentType)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      conversationId,
      memberId,
      input.body,
      input.attachment?.url ?? null,
      input.attachment?.name ?? null,
      input.attachment?.size ?? null,
      input.attachment?.type ?? null,
    ]
  );
  const rows = await listMessages(userId, conversationId, { after: result.lastInsertRowid - 1, limit: 1 });
  return rows[0];
}

/** Upserts the member's read cursor for a conversation — never moves it backwards, so a stale
 * client (e.g. an older tab) can't un-read messages a newer one already marked as read. */
export async function markRead(conversationId: number, memberId: number, lastReadMessageId: number): Promise<void> {
  await run(
    `INSERT INTO conversation_reads (conversationId, memberId, lastReadMessageId)
     VALUES (?, ?, ?)
     ON CONFLICT (conversationId, memberId) DO UPDATE SET
       lastReadMessageId = MAX(conversation_reads.lastReadMessageId, excluded.lastReadMessageId),
       updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    [conversationId, memberId, lastReadMessageId]
  );
}
