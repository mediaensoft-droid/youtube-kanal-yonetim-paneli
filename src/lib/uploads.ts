import "server-only";
import { put, del } from "@vercel/blob";

/** Vercel Blob is checked in at .../api/profile/avatar/route.ts — this module is the shared,
 * server-only home for the belge havuzu (F) and mesajlaşma (G) upload/validation logic. */

export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

/** Extension (lowercase, no dot) -> accepted MIME types for that extension. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel", "application/csv"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  mp4: ["video/mp4"],
  mp3: ["audio/mpeg", "audio/mp3"],
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
};

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

export type ValidateUploadResult = { ok: true; ext: string } | { ok: false; error: string };

/** Server-side type/size gate — the only place a file's extension or size is trusted from. */
export function validateUpload(file: File): ValidateUploadResult {
  if (file.size > MAX_UPLOAD_SIZE) {
    return { ok: false, error: "Dosya 25 MB'tan büyük olamaz" };
  }

  const ext = extensionOf(file.name);
  const allowedTypes = ALLOWED_UPLOAD_TYPES[ext];
  if (!allowedTypes) {
    return { ok: false, error: "Bu dosya türü desteklenmiyor" };
  }

  // Some browsers/OSes report a generic or empty MIME type for less common extensions — the
  // extension allowlist above is authoritative; a reported type is only cross-checked when it's
  // actually specific.
  if (file.type && file.type !== "application/octet-stream" && !allowedTypes.includes(file.type)) {
    return { ok: false, error: "Bu dosya türü desteklenmiyor" };
  }

  return { ok: true, ext };
}

/** Strips path separators, collapses whitespace, keeps unicode letters/digits/punctuation. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[/\\]+/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : "dosya";
}

export interface PutUploadResult {
  url: string;
  pathname: string;
}

export async function putUpload(prefix: string, file: File): Promise<PutUploadResult> {
  const name = safeFileName(file.name);
  const blob = await put(`${prefix}/${Date.now()}-${name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return { url: blob.url, pathname: blob.pathname };
}

/** Best-effort cleanup — a Blob delete failure must never surface as an API error. */
export async function deleteUpload(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // ignore
  }
}
