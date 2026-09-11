export type MemberRole = "yonetici" | "vekil" | "duzenleyici" | "goruntuleyici";

export const ROLE_LABELS: Record<MemberRole, string> = {
  yonetici: "Yönetici",
  vekil: "Vekil",
  duzenleyici: "Düzenleyici",
  goruntuleyici: "Görüntüleyici",
};

/** Roles the owner can assign to staff (the owner alone is yonetici). */
export const STAFF_ROLES: MemberRole[] = ["vekil", "duzenleyici", "goruntuleyici"];

export type Permission =
  | "channel.write" // add / edit / refresh / status change (incl. planned)
  | "channel.delete"
  | "taxonomy.write" // categories & concepts
  | "schedule.write" // calendar entries + publish-day patterns
  | "team.manage" // /team + member APIs
  | "billing.view"; // /billing, /profile (owner-only areas)

const MATRIX: Record<MemberRole, Permission[]> = {
  yonetici: ["channel.write", "channel.delete", "taxonomy.write", "schedule.write", "team.manage", "billing.view"],
  vekil: ["channel.write", "channel.delete", "taxonomy.write", "schedule.write"],
  duzenleyici: ["channel.write", "taxonomy.write", "schedule.write"],
  goruntuleyici: [],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function isMemberRole(value: unknown): value is MemberRole {
  return value === "yonetici" || value === "vekil" || value === "duzenleyici" || value === "goruntuleyici";
}
