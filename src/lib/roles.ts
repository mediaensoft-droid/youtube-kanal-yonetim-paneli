export type MemberRole = "yonetici" | "vekil" | "duzenleyici" | "goruntuleyici";

export const ROLE_LABELS: Record<MemberRole, string> = {
  yonetici: "Yönetici",
  vekil: "Vekil",
  duzenleyici: "Düzenleyici",
  goruntuleyici: "Görüntüleyici",
};

/** Roles assignable to staff accounts. The workspace owner (Google login, no username) is always yonetici. */
export const STAFF_ROLES: MemberRole[] = ["yonetici", "vekil", "duzenleyici", "goruntuleyici"];

export type Permission =
  | "channel.write" // add / edit / refresh / status change (incl. planned)
  | "channel.delete"
  | "taxonomy.write" // categories & concepts
  | "schedule.write" // calendar entries + publish-day patterns
  | "team.manage" // /team + member APIs
  | "billing.view" // /billing, /profile (owner-only areas)
  | "task.write" // task board: columns + cards create/edit/move/comment
  | "task.delete" // task board: card delete (column delete only requires task.write)
  | "files.write" // belge havuzu: klasör/dosya oluştur, yeniden adlandır, taşı
  | "files.delete"; // belge havuzu: klasör/dosya sil

const MATRIX: Record<MemberRole, Permission[]> = {
  yonetici: [
    "channel.write",
    "channel.delete",
    "taxonomy.write",
    "schedule.write",
    "team.manage",
    "billing.view",
    "task.write",
    "task.delete",
    "files.write",
    "files.delete",
  ],
  vekil: [
    "channel.write",
    "channel.delete",
    "taxonomy.write",
    "schedule.write",
    "task.write",
    "task.delete",
    "files.write",
    "files.delete",
  ],
  duzenleyici: ["channel.write", "taxonomy.write", "schedule.write", "task.write", "files.write"],
  goruntuleyici: [],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function isMemberRole(value: unknown): value is MemberRole {
  return value === "yonetici" || value === "vekil" || value === "duzenleyici" || value === "goruntuleyici";
}
