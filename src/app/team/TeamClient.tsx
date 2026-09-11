"use client";

import { useState } from "react";
import { Plus, Pencil, KeyRound, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Member, MemberStatus } from "@/lib/db/members";
import { STAFF_ROLES, ROLE_LABELS, type MemberRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatRelativeTime } from "@/lib/format";

interface TeamClientProps {
  initialMembers: Member[];
}

const ROLE_COLORS: Record<MemberRole, string> = {
  yonetici: "#EF4444",
  vekil: "#F59E0B",
  duzenleyici: "#3B82F6",
  goruntuleyici: "#6B7280",
};

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Aktif",
  disabled: "Pasif",
};

const ROLE_HINT = "Rol değişikliği personel yeniden giriş yapınca geçerli olur.";

export function TeamClient({ initialMembers }: TeamClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);

  const [addOpen, setAddOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<MemberRole>(STAFF_ROLES[0]);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<MemberRole>(STAFF_ROLES[0]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [passwordId, setPasswordId] = useState<number | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [disableTarget, setDisableTarget] = useState<Member | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<number | null>(null);

  function replaceMember(updated: Member) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newDisplayName,
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Üye eklenemedi");
      setMembers((prev) => [...prev, data]);
      setNewDisplayName("");
      setNewUsername("");
      setNewPassword("");
      setNewRole(STAFF_ROLES[0]);
      setAddOpen(false);
      toast.success("Üye eklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Üye eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(member: Member) {
    setEditId(member.id);
    setEditDisplayName(member.displayName);
    setEditRole(member.role as MemberRole);
    setPasswordId(null);
  }

  async function handleSaveEdit(id: number) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editDisplayName, role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Güncellenemedi");
      replaceMember(data);
      setEditId(null);
      toast.success("Üye güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setSavingEdit(false);
    }
  }

  function startPasswordEdit(member: Member) {
    setPasswordId(member.id);
    setPasswordValue("");
    setEditId(null);
  }

  async function handleSavePassword(id: number) {
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/team/${id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordValue }),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Şifre güncellenemedi");
      }
      setPasswordId(null);
      setPasswordValue("");
      toast.success("Şifre güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre güncellenemedi");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleStatusChange(member: Member, status: MemberStatus) {
    setStatusSavingId(member.id);
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Güncellenemedi");
      replaceMember(data);
      toast.success(status === "disabled" ? "Üye pasife alındı" : "Üye aktife alındı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setStatusSavingId(null);
      setDisableTarget(null);
    }
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Personel</h1>
        <Button onClick={() => setAddOpen((o) => !o)}>
          <Plus className="h-4 w-4" /> Personel Ekle
        </Button>
      </div>

      {addOpen && (
        <form
          onSubmit={handleCreate}
          className="animate-scale-in mb-6 origin-top space-y-3 rounded-lg border border-line bg-surface p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Görünen ad</label>
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Kullanıcı adı</label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Şifre</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Rol</label>
              <Select value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-ink-faint">{ROLE_HINT}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
      )}

      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
          Henüz personel eklenmedi.
        </p>
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs font-medium text-ink-muted">
                <th className="px-4 py-2.5">Ad</th>
                <th className="px-4 py-2.5">Kullanıcı adı</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">Durum</th>
                <th className="px-4 py-2.5">Son giriş</th>
                <th className="px-4 py-2.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isOwner = member.role === "yonetici";
                const isEditing = editId === member.id;
                const isPasswording = passwordId === member.id;

                return (
                  <tr key={member.id} className="border-b border-line bg-surface-2/40 last:border-b-0 align-top">
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <Input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="max-w-[220px]"
                        />
                      ) : (
                        <span className="font-medium text-ink">{member.displayName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {member.username ? `@${member.username}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="space-y-1">
                          <Select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as MemberRole)}
                            className="max-w-[180px]"
                          >
                            {STAFF_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </Select>
                          <p className="text-xs text-ink-faint">{ROLE_HINT}</p>
                        </div>
                      ) : (
                        <CategoryBadge name={ROLE_LABELS[member.role]} color={ROLE_COLORS[member.role as MemberRole]} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{STATUS_LABELS[member.status]}</td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {member.lastLoginAt ? formatRelativeTime(member.lastLoginAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {isOwner ? (
                        <div className="flex justify-end">
                          <CategoryBadge name="Siz" color="#6B7280" />
                        </div>
                      ) : isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => handleSaveEdit(member.id)} disabled={savingEdit}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : isPasswording ? (
                        <div className="flex justify-end items-center gap-2">
                          <Input
                            type="password"
                            value={passwordValue}
                            onChange={(e) => setPasswordValue(e.target.value)}
                            placeholder="Yeni şifre"
                            className="max-w-[160px]"
                          />
                          <Button variant="ghost" size="sm" onClick={() => setPasswordId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSavePassword(member.id)}
                            disabled={savingPassword || passwordValue.length < 8}
                          >
                            Kaydet
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            onClick={() => startEdit(member)}
                            title="Düzenle"
                            className="rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => startPasswordEdit(member)}
                            title="Şifre sıfırla"
                            className="rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          {member.status === "active" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setDisableTarget(member)}
                              disabled={statusSavingId === member.id}
                            >
                              Pasife al
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStatusChange(member, "active")}
                              disabled={statusSavingId === member.id}
                            >
                              Aktife al
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={disableTarget !== null}
        title="Üyeyi pasife al"
        description={
          disableTarget ? `"${disableTarget.displayName}" pasife alınacak ve giriş yapamayacak.` : undefined
        }
        confirmLabel="Pasife al"
        onConfirm={() => disableTarget && handleStatusChange(disableTarget, "disabled")}
        onCancel={() => setDisableTarget(null)}
      />
    </div>
  );
}
