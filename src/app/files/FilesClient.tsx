"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { toast } from "sonner";
import {
  Archive,
  ChevronRight,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Film,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Music,
  Pencil,
  Presentation,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { DocFile, DocFolder, DocFolderTreeItem } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatRelativeTime } from "@/lib/format";

interface BreadcrumbEntry {
  id: number;
  name: string;
}

export interface FilesClientProps {
  initialFolders: DocFolder[];
  initialFiles: DocFile[];
  initialBreadcrumb: BreadcrumbEntry[];
  canWrite: boolean;
  canDelete: boolean;
}

interface FolderContentsResponse {
  folders: DocFolder[];
  files: DocFile[];
  breadcrumb: BreadcrumbEntry[];
}

/** Picks the icon by extension using literal JSX per case (not a dynamic `<Icon/>` from a looked-up
 * component reference) so every rendered tag resolves to a statically-known import. */
function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
    case "md":
      return <FileText className={className} />;
    case "xls":
    case "xlsx":
    case "csv":
      return <FileSpreadsheet className={className} />;
    case "ppt":
    case "pptx":
      return <Presentation className={className} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return <ImageIcon className={className} />;
    case "mp4":
      return <Film className={className} />;
    case "mp3":
      return <Music className={className} />;
    case "zip":
      return <Archive className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

function uploadFileWithProgress(
  file: File,
  folderId: number | null,
  onProgress: (percent: number) => void
): Promise<DocFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as DocFile);
        } catch {
          reject(new Error("Sunucu yanıtı okunamadı"));
        }
        return;
      }
      let message = "Dosya yüklenemedi";
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string };
        if (typeof data.error === "string") message = data.error;
      } catch {
        // keep fallback
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Dosya yüklenemedi"));

    const formData = new FormData();
    formData.append("file", file);
    if (folderId !== null) formData.append("folderId", String(folderId));
    xhr.send(formData);
  });
}

interface TreeOption {
  id: number;
  name: string;
  depth: number;
}

function buildTreeOptions(folders: DocFolderTreeItem[]): TreeOption[] {
  const byParent = new Map<number | null, DocFolderTreeItem[]>();
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }
  const result: TreeOption[] = [];
  function walk(parentId: number | null, depth: number) {
    for (const child of byParent.get(parentId) ?? []) {
      result.push({ id: child.id, name: child.name, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

/** Removes a folder and its whole subtree from a pre-order `buildTreeOptions()` list — used so a
 * folder being moved can't be dropped into itself or one of its own descendants. */
function excludeSubtree(options: TreeOption[], rootId: number): TreeOption[] {
  const rootIndex = options.findIndex((o) => o.id === rootId);
  if (rootIndex === -1) return options;
  const rootDepth = options[rootIndex].depth;
  let endIndex = rootIndex + 1;
  while (endIndex < options.length && options[endIndex].depth > rootDepth) endIndex++;
  return [...options.slice(0, rootIndex), ...options.slice(endIndex)];
}

interface UploadItem {
  key: string;
  name: string;
  progress: number;
  error: string | null;
}

interface RowMenuProps {
  onRename: () => void;
  onMove: () => void;
  onDelete?: () => void;
}

const ROW_MENU_WIDTH = 176;

function RowMenu({ onRename, onMove, onDelete }: RowMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  function open() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: Math.max(8, Math.min(rect.right - ROW_MENU_WIDTH, window.innerWidth - ROW_MENU_WIDTH - 8)),
      y: Math.min(rect.bottom + 4, window.innerHeight - 160),
    });
  }

  function pick(action: () => void) {
    setPosition(null);
    action();
  }

  const items = [
    { label: "Yeniden adlandır", icon: Pencil, action: onRename, danger: false },
    { label: "Taşı", icon: FolderInput, action: onMove, danger: false },
    ...(onDelete ? [{ label: "Sil", icon: Trash2, action: onDelete, danger: true }] : []),
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        aria-label="İşlemler"
        aria-haspopup="menu"
        aria-expanded={position !== null}
        className="shrink-0 rounded p-1.5 text-ink-muted opacity-0 transition-colors duration-150 hover:bg-surface-hover hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* Portal to <body>: the page root's `.animate-fade-in-up` leaves a transform behind, which
          would otherwise make it the containing block for this `position: fixed` menu. */}
      {position &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPosition(null)} />
            <div
              role="menu"
              className="animate-scale-in fixed z-50 origin-top-right rounded-md border border-line-strong bg-surface-2 p-1 shadow-2xl shadow-black/50"
              style={{ left: position.x, top: position.y, width: ROW_MENU_WIDTH }}
            >
              {items.map(({ label, icon: Icon, action, danger }) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(action)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium transition-colors duration-150",
                    danger ? "text-red-400 hover:bg-red-950/40" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

interface FolderRowProps {
  folder: DocFolder;
  canWrite: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

function FolderRow({ folder, canWrite, canDelete, onOpen, onRename, onMove, onDelete }: FolderRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-hover">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <FolderOpen className="h-5 w-5 shrink-0 text-brand" />
        <span className="truncate text-sm font-medium text-ink">{folder.name}</span>
      </button>
      <span className="shrink-0 text-xs text-ink-faint">{folder.itemCount} öğe</span>
      {canWrite && <RowMenu onRename={onRename} onMove={onMove} onDelete={canDelete ? onDelete : undefined} />}
    </div>
  );
}

interface FileRowProps {
  file: DocFile;
  canWrite: boolean;
  canDelete: boolean;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

function FileRow({ file, canWrite, canDelete, onRename, onMove, onDelete }: FileRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-hover">
      <a
        href={file.blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <FileTypeIcon name={file.name} className="h-5 w-5 shrink-0 text-ink-muted" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-ink">{file.name}</span>
          <span className="truncate text-xs text-ink-faint">
            {formatFileSize(file.size)} · {file.uploadedByName ?? "—"} · {formatRelativeTime(file.createdAt)}
          </span>
        </div>
      </a>
      {canWrite && <RowMenu onRename={onRename} onMove={onMove} onDelete={canDelete ? onDelete : undefined} />}
    </div>
  );
}

interface SearchResultsListProps {
  results: DocFile[];
  loading: boolean;
  onOpenFolder: (folderId: number) => void;
}

function SearchResultsList({ results, loading, onOpenFolder }: SearchResultsListProps) {
  if (loading && results.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Aranıyor…
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
        Sonuç bulunamadı.
      </p>
    );
  }
  return (
    <div className="flex flex-col rounded-md border border-line bg-surface-2 p-1.5">
      {results.map((file) => {
        return (
          <div key={file.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-hover">
            <a
              href={file.blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <FileTypeIcon name={file.name} className="h-5 w-5 shrink-0 text-ink-muted" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ink">{file.name}</span>
                <span className="truncate text-xs text-ink-faint">
                  {formatFileSize(file.size)} · {file.uploadedByName ?? "—"} · {formatRelativeTime(file.createdAt)}
                </span>
              </div>
            </a>
            {file.folderId !== null && file.folderName ? (
              <button
                type="button"
                onClick={() => onOpenFolder(file.folderId!)}
                className="shrink-0 text-xs text-ink-faint hover:text-ink hover:underline"
              >
                klasörde: {file.folderName}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-ink-faint">kökte</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TextPromptModalProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}

function TextPromptModal({ title, value, onChange, onCancel, onConfirm, saving }: TextPromptModalProps) {
  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-sm rounded-lg border border-line-strong bg-surface-2 p-5 shadow-2xl shadow-black/50">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-3"
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
          }}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Vazgeç
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={saving}>
            Kaydet
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface MoveModalProps {
  title: string;
  options: TreeOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}

function MoveModal({ title, options, value, onChange, onCancel, onConfirm, saving }: MoveModalProps) {
  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-scale-in w-full max-w-sm rounded-lg border border-line-strong bg-surface-2 p-5 shadow-2xl shadow-black/50">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <Select
          value={value === null ? "root" : String(value)}
          onChange={(e) => onChange(e.target.value === "root" ? null : Number(e.target.value))}
          className="mt-3"
        >
          <option value="root">Belgeler (kök dizin)</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {"— ".repeat(opt.depth)}
              {opt.name}
            </option>
          ))}
        </Select>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Vazgeç
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={saving}>
            Taşı
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type EntityKind = "folder" | "file";

interface EntityRef {
  kind: EntityKind;
  id: number;
  name: string;
}

export function FilesClient({
  initialFolders,
  initialFiles,
  initialBreadcrumb,
  canWrite,
  canDelete,
}: FilesClientProps) {
  const [folderId, setFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<DocFolder[]>(initialFolders);
  const [files, setFiles] = useState<DocFile[]>(initialFiles);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>(initialBreadcrumb);
  const [loadingFolder, setLoadingFolder] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DocFile[]>([]);
  const [searching, setSearching] = useState(false);
  const trimmedSearch = search.trim();
  const isSearching = trimmedSearch.length > 0;

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);

  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [renameTarget, setRenameTarget] = useState<EntityRef | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  const [moveTarget, setMoveTarget] = useState<EntityRef | null>(null);
  const [moveDestination, setMoveDestination] = useState<number | null>(null);
  const [moveTreeFolders, setMoveTreeFolders] = useState<DocFolderTreeItem[] | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EntityRef | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadFolder = useCallback(async (id: number | null) => {
    setLoadingFolder(true);
    try {
      const params = id !== null ? `?folderId=${id}` : "";
      const res = await fetch(`/api/files${params}`);
      if (!res.ok) throw new Error(await readError(res, "Klasör yüklenemedi"));
      const data: FolderContentsResponse = await res.json();
      setFolderId(id);
      setFolders(data.folders);
      setFiles(data.files);
      setBreadcrumb(data.breadcrumb);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klasör yüklenemedi");
    } finally {
      setLoadingFolder(false);
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(await readError(res, "Arama başarısız"));
      const data: DocFile[] = await res.json();
      setSearchResults(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Arama başarısız");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    // Nothing to fetch for a blank query — `isSearching` (derived from `trimmedSearch`) already
    // keeps the search-results view hidden, so stale `searchResults` sitting in state is harmless.
    if (!trimmedSearch) return;
    const timer = setTimeout(() => {
      void runSearch(trimmedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmedSearch, runSearch]);

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    setFolderSaving(true);
    try {
      const res = await fetch("/api/files/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: folderId }),
      });
      if (!res.ok) throw new Error(await readError(res, "Klasör oluşturulamadı"));
      toast.success("Klasör oluşturuldu");
      setNewFolderName("");
      setCreatingFolder(false);
      await loadFolder(folderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klasör oluşturulamadı");
    } finally {
      setFolderSaving(false);
    }
  }

  async function uploadFiles(fileList: File[], targetFolderId: number | null) {
    for (const file of fileList) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploadQueue((prev) => [...prev, { key, name: file.name, progress: 0, error: null }]);
      try {
        const uploaded = await uploadFileWithProgress(file, targetFolderId, (percent) => {
          setUploadQueue((prev) => prev.map((u) => (u.key === key ? { ...u, progress: percent } : u)));
        });
        if (targetFolderId === folderId) {
          setFiles((prev) => [...prev, uploaded].sort((a, b) => a.name.localeCompare(b.name, "tr")));
        }
        setTimeout(() => {
          setUploadQueue((prev) => prev.filter((u) => u.key !== key));
        }, 1200);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dosya yüklenemedi";
        setUploadQueue((prev) => prev.map((u) => (u.key === key ? { ...u, error: message } : u)));
        toast.error(`${file.name}: ${message}`);
      }
    }
  }

  function handleFilesSelected(fileList: FileList) {
    const filesArr = Array.from(fileList);
    if (filesArr.length === 0) return;
    void uploadFiles(filesArr, folderId);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (!canWrite) return;
    if (e.dataTransfer.files.length > 0) handleFilesSelected(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!canWrite) return;
    setDragActive(true);
  }

  function openRename(target: EntityRef) {
    setRenameTarget(target);
    setRenameValue(target.name);
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Ad boş olamaz");
      return;
    }
    setRenameSaving(true);
    try {
      const url = renameTarget.kind === "folder" ? `/api/files/folders/${renameTarget.id}` : `/api/files/${renameTarget.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res, "Yeniden adlandırılamadı"));
      toast.success("Yeniden adlandırıldı");
      setRenameTarget(null);
      await loadFolder(folderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yeniden adlandırılamadı");
    } finally {
      setRenameSaving(false);
    }
  }

  async function openMoveDialog(target: EntityRef, currentFolderId: number | null) {
    setMoveTarget(target);
    setMoveDestination(currentFolderId);
    setMoveTreeFolders(null);
    try {
      const res = await fetch("/api/files/folders/tree");
      if (!res.ok) throw new Error(await readError(res, "Klasörler yüklenemedi"));
      const data: DocFolderTreeItem[] = await res.json();
      setMoveTreeFolders(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klasörler yüklenemedi");
      setMoveTarget(null);
    }
  }

  async function confirmMove() {
    if (!moveTarget) return;
    setMoveSaving(true);
    try {
      const url = moveTarget.kind === "folder" ? `/api/files/folders/${moveTarget.id}` : `/api/files/${moveTarget.id}`;
      const bodyKey = moveTarget.kind === "folder" ? "parentId" : "folderId";
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [bodyKey]: moveDestination }),
      });
      if (!res.ok) throw new Error(await readError(res, "Taşınamadı"));
      toast.success(moveTarget.kind === "folder" ? "Klasör taşındı" : "Dosya taşındı");
      setMoveTarget(null);
      await loadFolder(folderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Taşınamadı");
    } finally {
      setMoveSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const url = deleteTarget.kind === "folder" ? `/api/files/folders/${deleteTarget.id}` : `/api/files/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await readError(res, "Silinemedi"));
      toast.success(deleteTarget.kind === "folder" ? "Klasör silindi" : "Dosya silindi");
      setDeleteTarget(null);
      await loadFolder(folderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  const moveOptions = useMemo(() => {
    if (!moveTreeFolders) return [];
    const options = buildTreeOptions(moveTreeFolders);
    return moveTarget?.kind === "folder" ? excludeSubtree(options, moveTarget.id) : options;
  }, [moveTreeFolders, moveTarget]);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Belgeler</h1>
        <p className="mt-1 text-sm text-ink-muted">Ekip için ortak dosya ve klasör havuzu.</p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tüm belgelerde ara…"
          className="pl-9"
        />
      </div>

      {!isSearching && (
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => void loadFolder(null)}
            className={clsx(
              "rounded px-1 py-0.5",
              breadcrumb.length === 0 ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            Belgeler
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
              <button
                type="button"
                onClick={() => void loadFolder(crumb.id)}
                className={clsx(
                  "rounded px-1 py-0.5",
                  i === breadcrumb.length - 1 ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      {isSearching ? (
        <SearchResultsList
          results={searchResults}
          loading={searching}
          onOpenFolder={(id) => {
            setSearch("");
            void loadFolder(id);
          }}
        />
      ) : (
        <>
          {canWrite && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {!creatingFolder ? (
                <Button variant="secondary" size="sm" onClick={() => setCreatingFolder(true)}>
                  <FolderPlus className="h-4 w-4" />
                  Klasör oluştur
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Klasör adı"
                    className="w-48"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitNewFolder();
                      if (e.key === "Escape") {
                        setCreatingFolder(false);
                        setNewFolderName("");
                      }
                    }}
                  />
                  <Button size="sm" onClick={() => void submitNewFolder()} disabled={folderSaving}>
                    Oluştur
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreatingFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    Vazgeç
                  </Button>
                </div>
              )}

              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Dosya yükle
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFilesSelected(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {uploadQueue.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 p-2">
              {uploadQueue.map((u) => (
                <div key={u.key} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-ink-muted">{u.name}</span>
                  {u.error ? (
                    <span className="text-red-400">{u.error}</span>
                  ) : (
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full bg-brand transition-all duration-150"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            onDragOver={onDragOver}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={clsx(
              "min-h-[40vh] rounded-md border p-1.5 transition-colors duration-150",
              canWrite && dragActive ? "border-brand bg-brand/5" : "border-line bg-surface-2"
            )}
          >
            {loadingFolder ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
              </div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-ink-muted">Bu klasör boş.</div>
            ) : (
              <div className="flex flex-col">
                {folders.map((folder) => (
                  <FolderRow
                    key={`folder-${folder.id}`}
                    folder={folder}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    onOpen={() => void loadFolder(folder.id)}
                    onRename={() => openRename({ kind: "folder", id: folder.id, name: folder.name })}
                    onMove={() =>
                      void openMoveDialog({ kind: "folder", id: folder.id, name: folder.name }, folder.parentId)
                    }
                    onDelete={() => setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name })}
                  />
                ))}
                {files.map((file) => (
                  <FileRow
                    key={`file-${file.id}`}
                    file={file}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    onRename={() => openRename({ kind: "file", id: file.id, name: file.name })}
                    onMove={() => void openMoveDialog({ kind: "file", id: file.id, name: file.name }, file.folderId)}
                    onDelete={() => setDeleteTarget({ kind: "file", id: file.id, name: file.name })}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {renameTarget && (
        <TextPromptModal
          title={renameTarget.kind === "folder" ? "Klasörü yeniden adlandır" : "Dosyayı yeniden adlandır"}
          value={renameValue}
          onChange={setRenameValue}
          onCancel={() => setRenameTarget(null)}
          onConfirm={() => void confirmRename()}
          saving={renameSaving}
        />
      )}

      {moveTarget && moveTreeFolders && (
        <MoveModal
          title={moveTarget.kind === "folder" ? "Klasörü taşı" : "Dosyayı taşı"}
          options={moveOptions}
          value={moveDestination}
          onChange={setMoveDestination}
          onCancel={() => setMoveTarget(null)}
          onConfirm={() => void confirmMove()}
          saving={moveSaving}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === "folder" ? "Klasörü sil" : "Dosyayı sil"}
        description={
          deleteTarget?.kind === "folder"
            ? `"${deleteTarget.name}" klasörünü ve içindeki tüm alt klasör ve dosyaları silmek istediğine emin misin? Bu işlem geri alınamaz.`
            : `"${deleteTarget?.name}" dosyasını silmek istediğine emin misin? Bu işlem geri alınamaz.`
        }
        confirmLabel="Sil"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
