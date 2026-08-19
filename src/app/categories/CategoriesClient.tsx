"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ColorPicker } from "@/components/ColorPicker";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CATEGORICAL_PALETTE } from "@/lib/colors";

interface CategoriesClientProps {
  initialCategories: Category[];
  channelCounts: Record<number, number>;
}

export function CategoriesClient({ initialCategories, channelCounts }: CategoriesClientProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [counts, setCounts] = useState<Record<number, number>>(channelCounts);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CATEGORICAL_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kategori eklenemedi");
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewColor(CATEGORICAL_PALETTE[0]);
      setAddOpen(false);
      toast.success("Kategori eklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kategori eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category: Category) {
    setEditId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Güncellenemedi");
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? data : c)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditId(null);
      toast.success("Kategori güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Silinemedi");
      }
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setCounts((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      toast.success("Kategori silindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="animate-fade-in-up mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Kategoriler</h1>
        <Button onClick={() => setAddOpen((o) => !o)}>
          <Plus className="h-4 w-4" /> Kategori Ekle
        </Button>
      </div>

      {addOpen && (
        <form
          onSubmit={handleCreate}
          className="animate-scale-in mb-6 origin-top space-y-3 rounded-lg border border-line bg-surface p-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Kategori adı</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Renk</label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              Kaydet
            </Button>
          </div>
        </form>
      )}

      <div className="divide-y divide-line rounded-lg border border-line bg-surface">
        {categories.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">Henüz kategori eklenmedi.</p>
        )}
        {categories.map((category) => (
          <div key={category.id} className="p-4 transition-colors duration-150 hover:bg-surface-hover/50">
            {editId === category.id ? (
              <div className="space-y-3">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(category.id)}
                    disabled={saving}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CategoryBadge name={category.name} color={category.color} />
                  <span className="text-xs text-ink-faint">
                    {counts[category.id] ?? 0} kanal
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(category)}
                    className="rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(category)}
                    className="rounded-md p-1.5 text-red-400 transition-colors duration-150 hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Kategoriyi sil"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" silinecek. Bu kategoriye sahip ${
                counts[deleteTarget.id] ?? 0
              } kanal kategorisiz kalacak.`
            : undefined
        }
        confirmLabel={deleting ? "Siliniyor..." : "Sil"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
