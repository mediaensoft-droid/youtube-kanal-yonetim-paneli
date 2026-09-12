import "server-only";
import { all, get, run } from "@/lib/db";
import type { DocFolder, DocFile, DocFolderTreeItem } from "@/types";

interface DocFolderRow {
  id: number;
  parentId: number | null;
  name: string;
  createdByMemberId: number | null;
  createdAt: string;
  itemCount: number;
}

function rowToFolder(row: DocFolderRow): DocFolder {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    createdByMemberId: row.createdByMemberId,
    createdAt: row.createdAt,
    itemCount: row.itemCount,
  };
}

// Correlated subqueries count direct children (subfolders + files) without an extra round trip.
const FOLDER_COLUMNS_WITH_COUNT = `
  f.id, f.parentId, f.name, f.createdByMemberId, f.createdAt,
  (SELECT COUNT(*) FROM doc_folders sf WHERE sf.parentId = f.id AND sf.userId = f.userId) +
  (SELECT COUNT(*) FROM doc_files df2 WHERE df2.folderId = f.id AND df2.userId = f.userId) AS itemCount
`;

interface DocFileRow {
  id: number;
  folderId: number | null;
  name: string;
  blobUrl: string;
  size: number;
  contentType: string;
  description: string | null;
  uploadedByMemberId: number | null;
  uploadedByName: string | null;
  createdAt: string;
  folderName?: string | null;
}

function rowToFile(row: DocFileRow): DocFile {
  return {
    id: row.id,
    folderId: row.folderId,
    name: row.name,
    blobUrl: row.blobUrl,
    size: row.size,
    contentType: row.contentType,
    description: row.description,
    uploadedByMemberId: row.uploadedByMemberId,
    uploadedByName: row.uploadedByName,
    createdAt: row.createdAt,
    folderName: row.folderName ?? undefined,
  };
}

const FILE_COLUMNS_WITH_UPLOADER = `
  df.id, df.folderId, df.name, df.blobUrl, df.size, df.contentType, df.description,
  df.uploadedByMemberId, m.displayName AS uploadedByName, df.createdAt
`;

export async function getFolderById(userId: number, id: number): Promise<DocFolder | undefined> {
  const row = await get<DocFolderRow>(
    `SELECT ${FOLDER_COLUMNS_WITH_COUNT} FROM doc_folders f WHERE f.id = ? AND f.userId = ?`,
    [id, userId]
  );
  return row ? rowToFolder(row) : undefined;
}

export async function getFileById(userId: number, id: number): Promise<DocFile | undefined> {
  const row = await get<DocFileRow>(
    `SELECT ${FILE_COLUMNS_WITH_UPLOADER}
       FROM doc_files df
       LEFT JOIN members m ON m.id = df.uploadedByMemberId
      WHERE df.id = ? AND df.userId = ?`,
    [id, userId]
  );
  return row ? rowToFile(row) : undefined;
}

interface BreadcrumbEntry {
  id: number;
  name: string;
}

async function buildBreadcrumb(userId: number, folderId: number | null): Promise<BreadcrumbEntry[]> {
  const crumbs: BreadcrumbEntry[] = [];
  let currentId = folderId;
  while (currentId !== null) {
    const row = await get<{ id: number; name: string; parentId: number | null }>(
      `SELECT id, name, parentId FROM doc_folders WHERE id = ? AND userId = ?`,
      [currentId, userId]
    );
    if (!row) break;
    crumbs.unshift({ id: row.id, name: row.name });
    currentId = row.parentId;
  }
  return crumbs;
}

export interface FolderContents {
  folders: DocFolder[];
  files: DocFile[];
  breadcrumb: BreadcrumbEntry[];
}

export async function listFolderContents(userId: number, folderId: number | null): Promise<FolderContents> {
  const folderWhere = folderId === null ? "f.parentId IS NULL" : "f.parentId = ?";
  const fileWhere = folderId === null ? "df.folderId IS NULL" : "df.folderId = ?";
  const folderParams = folderId === null ? [userId] : [userId, folderId];
  const fileParams = folderId === null ? [userId] : [userId, folderId];

  const [folderRows, fileRows, breadcrumb] = await Promise.all([
    all<DocFolderRow>(
      `SELECT ${FOLDER_COLUMNS_WITH_COUNT} FROM doc_folders f WHERE f.userId = ? AND ${folderWhere} ORDER BY f.name COLLATE NOCASE`,
      folderParams
    ),
    all<DocFileRow>(
      `SELECT ${FILE_COLUMNS_WITH_UPLOADER}
         FROM doc_files df
         LEFT JOIN members m ON m.id = df.uploadedByMemberId
        WHERE df.userId = ? AND ${fileWhere}
        ORDER BY df.name COLLATE NOCASE`,
      fileParams
    ),
    buildBreadcrumb(userId, folderId),
  ]);

  return { folders: folderRows.map(rowToFolder), files: fileRows.map(rowToFile), breadcrumb };
}

/** Flat search across the whole workspace — matches file name, description, or containing-folder name. */
export async function searchFiles(userId: number, q: string): Promise<DocFile[]> {
  const like = `%${q}%`;
  const rows = await all<DocFileRow>(
    `SELECT ${FILE_COLUMNS_WITH_UPLOADER}, fo.name AS folderName
       FROM doc_files df
       LEFT JOIN members m ON m.id = df.uploadedByMemberId
       LEFT JOIN doc_folders fo ON fo.id = df.folderId
      WHERE df.userId = ?
        AND (df.name LIKE ? COLLATE NOCASE OR df.description LIKE ? COLLATE NOCASE OR fo.name LIKE ? COLLATE NOCASE)
      ORDER BY df.name COLLATE NOCASE
      LIMIT 50`,
    [userId, like, like, like]
  );
  return rows.map(rowToFile);
}

/** All folders in the workspace, flat — used by the "move to folder" picker. */
export async function listAllFolders(userId: number): Promise<DocFolderTreeItem[]> {
  return all<DocFolderTreeItem>(
    `SELECT id, name, parentId FROM doc_folders WHERE userId = ? ORDER BY name COLLATE NOCASE`,
    [userId]
  );
}

export interface CreateFolderInput {
  name: string;
  parentId?: number | null;
}

export async function createFolder(
  userId: number,
  memberId: number,
  input: CreateFolderInput
): Promise<DocFolder> {
  if (input.parentId) {
    const parent = await getFolderById(userId, input.parentId);
    if (!parent) throw new Error("Hedef klasör bulunamadı");
  }
  const result = await run(
    `INSERT INTO doc_folders (userId, parentId, name, createdByMemberId) VALUES (?, ?, ?, ?)`,
    [userId, input.parentId ?? null, input.name, memberId]
  );
  return (await getFolderById(userId, result.lastInsertRowid))!;
}

/** Every folder id in the subtree rooted at `rootId`, `rootId` itself included. */
async function collectDescendantFolderIds(userId: number, rootId: number): Promise<number[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const placeholders = frontier.map(() => "?").join(", ");
    const rows = await all<{ id: number }>(
      `SELECT id FROM doc_folders WHERE userId = ? AND parentId IN (${placeholders})`,
      [userId, ...frontier]
    );
    if (rows.length === 0) break;
    frontier = rows.map((r) => r.id);
    ids.push(...frontier);
  }
  return ids;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: number | null;
}

export async function updateFolder(userId: number, id: number, patch: UpdateFolderInput): Promise<DocFolder> {
  const existing = await getFolderById(userId, id);
  if (!existing) throw new Error("Klasör bulunamadı");

  if (patch.parentId !== undefined && patch.parentId !== existing.parentId) {
    if (patch.parentId !== null) {
      if (patch.parentId === id) throw new Error("Bir klasör kendi içine taşınamaz");
      const descendantIds = await collectDescendantFolderIds(userId, id);
      if (descendantIds.includes(patch.parentId)) {
        throw new Error("Bir klasör kendi alt klasörüne taşınamaz");
      }
      const targetParent = await getFolderById(userId, patch.parentId);
      if (!targetParent) throw new Error("Hedef klasör bulunamadı");
    }
    await run(`UPDATE doc_folders SET parentId = ? WHERE id = ? AND userId = ?`, [
      patch.parentId,
      id,
      userId,
    ]);
  }

  if (patch.name !== undefined) {
    await run(`UPDATE doc_folders SET name = ? WHERE id = ? AND userId = ?`, [patch.name, id, userId]);
  }

  return (await getFolderById(userId, id))!;
}

/**
 * Deletes a folder and everything under it. Subfolder rows CASCADE via parentId, but doc_files'
 * folderId FK is SET NULL (not CASCADE) — so file rows in this subtree are deleted explicitly
 * here first, otherwise they'd silently reappear at the workspace root instead of being removed.
 * Returns the blob URLs of every deleted file so the caller can clean them up in Blob storage.
 */
export async function deleteFolder(userId: number, id: number): Promise<string[]> {
  const existing = await getFolderById(userId, id);
  if (!existing) throw new Error("Klasör bulunamadı");

  const folderIds = await collectDescendantFolderIds(userId, id);
  const placeholders = folderIds.map(() => "?").join(", ");

  const files = await all<{ blobUrl: string }>(
    `SELECT blobUrl FROM doc_files WHERE userId = ? AND folderId IN (${placeholders})`,
    [userId, ...folderIds]
  );

  await run(`DELETE FROM doc_files WHERE userId = ? AND folderId IN (${placeholders})`, [
    userId,
    ...folderIds,
  ]);
  // Deleting the root folder CASCADEs the rest of the subtree's doc_folders rows.
  await run(`DELETE FROM doc_folders WHERE id = ? AND userId = ?`, [id, userId]);

  return files.map((f) => f.blobUrl);
}

export interface CreateFileInput {
  folderId?: number | null;
  name: string;
  blobUrl: string;
  blobPathname?: string | null;
  size: number;
  contentType: string;
  description?: string | null;
}

export async function createFile(userId: number, memberId: number, input: CreateFileInput): Promise<DocFile> {
  if (input.folderId) {
    const folder = await getFolderById(userId, input.folderId);
    if (!folder) throw new Error("Klasör bulunamadı");
  }
  const result = await run(
    `INSERT INTO doc_files (userId, folderId, name, blobUrl, blobPathname, size, contentType, description, uploadedByMemberId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.folderId ?? null,
      input.name,
      input.blobUrl,
      input.blobPathname ?? null,
      input.size,
      input.contentType,
      input.description ?? null,
      memberId,
    ]
  );
  return (await getFileById(userId, result.lastInsertRowid))!;
}

export interface UpdateFileInput {
  name?: string;
  folderId?: number | null;
  description?: string | null;
}

export async function updateFile(userId: number, id: number, patch: UpdateFileInput): Promise<DocFile> {
  const existing = await getFileById(userId, id);
  if (!existing) throw new Error("Dosya bulunamadı");

  if (patch.folderId !== undefined && patch.folderId !== null) {
    const folder = await getFolderById(userId, patch.folderId);
    if (!folder) throw new Error("Klasör bulunamadı");
  }

  const name = patch.name ?? existing.name;
  const folderId = patch.folderId !== undefined ? patch.folderId : existing.folderId;
  const description = patch.description !== undefined ? patch.description : existing.description;

  await run(`UPDATE doc_files SET name = ?, folderId = ?, description = ? WHERE id = ? AND userId = ?`, [
    name,
    folderId,
    description,
    id,
    userId,
  ]);

  return (await getFileById(userId, id))!;
}

/** Deletes the file row and returns its blob URL so the caller can remove it from Blob storage. */
export async function deleteFile(userId: number, id: number): Promise<string> {
  const existing = await getFileById(userId, id);
  if (!existing) throw new Error("Dosya bulunamadı");
  await run(`DELETE FROM doc_files WHERE id = ? AND userId = ?`, [id, userId]);
  return existing.blobUrl;
}
