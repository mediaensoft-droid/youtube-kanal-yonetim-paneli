// Pure module — no "server-only", no DB access. Shared between the API route (which logs
// activity_log rows) and the /team/activity panel (which renders them), plus its own unit tests.

export type ActivityAction =
  | "channel.create"
  | "channel.update"
  | "channel.status"
  | "channel.delete"
  | "channel.refresh"
  | "category.create"
  | "category.update"
  | "category.delete"
  | "concept.create"
  | "concept.update"
  | "concept.delete"
  | "schedule.upsert"
  | "schedule.delete"
  | "schedule.pattern"
  | "member.create"
  | "member.update"
  | "member.password"
  | "member.status"
  | "auth.login"
  | "account.update"
  | "account.password"
  | "task.create"
  | "task.update"
  | "task.move"
  | "task.complete"
  | "task.delete"
  | "task.comment";

/** Filter groups for the "İşlem türü" dropdown on /team/activity. */
export const ACTIVITY_TYPES: Record<string, ActivityAction[]> = {
  channel: ["channel.create", "channel.update", "channel.status", "channel.delete", "channel.refresh"],
  taxonomy: [
    "category.create",
    "category.update",
    "category.delete",
    "concept.create",
    "concept.update",
    "concept.delete",
  ],
  schedule: ["schedule.upsert", "schedule.delete", "schedule.pattern"],
  member: ["member.create", "member.update", "member.password", "member.status", "account.update", "account.password"],
  auth: ["auth.login"],
  task: ["task.create", "task.update", "task.move", "task.complete", "task.delete", "task.comment"],
};

export const ACTION_LABELS: Record<ActivityAction, string> = {
  "channel.create": "Kanal ekledi",
  "channel.update": "Kanal düzenledi",
  "channel.status": "Kanal durumu değiştirdi",
  "channel.delete": "Kanal sildi",
  "channel.refresh": "Kanal yeniledi",
  "category.create": "Kategori ekledi",
  "category.update": "Kategori düzenledi",
  "category.delete": "Kategori sildi",
  "concept.create": "Konsept ekledi",
  "concept.update": "Konsept düzenledi",
  "concept.delete": "Konsept sildi",
  "schedule.upsert": "Takvim kaydı",
  "schedule.delete": "Takvim kaydı sildi",
  "schedule.pattern": "Yayın günleri",
  "member.create": "Personel ekledi",
  "member.update": "Personel düzenledi",
  "member.password": "Personel şifresini sıfırladı",
  "member.status": "Personel durumu değiştirdi",
  "auth.login": "Giriş yaptı",
  "account.update": "Hesabını güncelledi",
  "account.password": "Şifresini güncelledi",
  "task.create": "Görev oluşturdu",
  "task.update": "Görev düzenledi",
  "task.move": "Görev taşıdı",
  "task.complete": "Görev tamamladı",
  "task.delete": "Görev sildi",
  "task.comment": "Göreve yorum yazdı",
};

/** Turkish labels for `channel.update`/`task.update`'s details.changedFields entries. */
export const FIELD_LABELS: Record<string, string> = {
  categoryIds: "kategoriler",
  conceptIds: "konseptler",
  languages: "diller",
  countries: "ülkeler",
  notes: "notlar",
  publishDays: "yayın günleri",
  publishTime: "yayın saati",
  url: "URL",
  aiTools: "yapay zeka araçları",
  title: "başlık",
  description: "açıklama",
  assigneeMemberId: "atanan kişi",
  channelId: "kanal",
  dueDate: "son tarih",
  priority: "öncelik",
  checklist: "kontrol listesi",
};

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  planned: "planlandı",
  published: "yayınlandı",
  skipped: "atlandı",
};

/** Minimal shape describeActivity needs — satisfied by the (Task 2) ActivityItem type. */
export interface ActivityDescribable {
  action: string;
  entityName?: string | null;
  details?: Record<string, unknown> | null;
}

export interface ActivityDescription {
  subject: string | null;
  text: string;
}

export function describeActivity(item: ActivityDescribable): ActivityDescription {
  const entityName = item.entityName ?? null;
  const details = item.details ?? {};

  switch (item.action) {
    case "channel.create": {
      const status = details.status;
      return {
        subject: entityName,
        text: status === "planned" ? "kanalını planlanan kanal olarak ekledi" : "kanalını ekledi",
      };
    }
    case "channel.update": {
      const changedFields = Array.isArray(details.changedFields) ? (details.changedFields as unknown[]) : [];
      const labels = changedFields
        .filter((field): field is string => typeof field === "string")
        .map((field) => FIELD_LABELS[field] ?? field);
      return {
        subject: entityName,
        text: labels.length > 0 ? `kanalını düzenledi (${labels.join(", ")})` : "kanalını düzenledi",
      };
    }
    case "channel.status": {
      const to = details.to;
      const suffix = to === "passive" ? "pasife aldı" : to === "planned" ? "planlanana taşıdı" : "aktife aldı";
      return { subject: entityName, text: `kanalını ${suffix}` };
    }
    case "channel.delete":
      return { subject: entityName, text: "kanalını sildi" };
    case "channel.refresh":
      return { subject: entityName, text: "kanalının YouTube verilerini yeniledi" };
    case "category.create":
      return { subject: entityName, text: "kategorisini ekledi" };
    case "category.update":
      return { subject: entityName, text: "kategorisini düzenledi" };
    case "category.delete":
      return { subject: entityName, text: "kategorisini sildi" };
    case "concept.create":
      return { subject: entityName, text: "konseptini ekledi" };
    case "concept.update":
      return { subject: entityName, text: "konseptini düzenledi" };
    case "concept.delete":
      return { subject: entityName, text: "konseptini sildi" };
    case "schedule.upsert": {
      const date = typeof details.date === "string" ? details.date : "";
      const statusKey = typeof details.status === "string" ? details.status : "";
      const statusLabel = SCHEDULE_STATUS_LABELS[statusKey] ?? statusKey;
      const parts = ["için", date, "tarihini", statusLabel, "yaptı"].filter((part) => part.length > 0);
      return { subject: entityName, text: parts.join(" ") };
    }
    case "schedule.delete": {
      const date = typeof details.date === "string" ? details.date : "";
      return {
        subject: entityName,
        text: date ? `için ${date} tarihindeki takvim kaydını sildi` : "takvim kaydını sildi",
      };
    }
    case "schedule.pattern": {
      const yearMonth = typeof details.yearMonth === "string" ? details.yearMonth : "";
      return { subject: entityName, text: `kanalının ${yearMonth} yayın günlerini değiştirdi`.trim() };
    }
    case "member.create":
      return { subject: entityName, text: "adlı personeli ekledi" };
    case "member.update":
      return { subject: entityName, text: "adlı personeli düzenledi" };
    case "member.password":
      return { subject: entityName, text: "adlı personelin şifresini sıfırladı" };
    case "member.status": {
      const to = details.to;
      const suffix = to === "disabled" ? "pasife aldı" : "aktife aldı";
      return { subject: entityName, text: `adlı personeli ${suffix}` };
    }
    case "auth.login":
      return { subject: null, text: "sisteme giriş yaptı" };
    case "account.update":
      return { subject: null, text: "hesabını güncelledi" };
    case "account.password":
      return { subject: null, text: "şifresini güncelledi" };
    case "task.create":
      return { subject: entityName, text: "görevini oluşturdu" };
    case "task.update": {
      const changedFields = Array.isArray(details.changedFields) ? (details.changedFields as unknown[]) : [];
      const labels = changedFields
        .filter((field): field is string => typeof field === "string")
        .map((field) => FIELD_LABELS[field] ?? field);
      return {
        subject: entityName,
        text: labels.length > 0 ? `görevini düzenledi (${labels.join(", ")})` : "görevini düzenledi",
      };
    }
    case "task.move": {
      const to = typeof details.to === "string" ? details.to : "";
      return { subject: entityName, text: to ? `görevini ${to} sütununa taşıdı` : "görevini taşıdı" };
    }
    case "task.complete":
      return { subject: entityName, text: "görevini tamamladı" };
    case "task.delete":
      return { subject: entityName, text: "görevini sildi" };
    case "task.comment":
      return { subject: entityName, text: "görevine yorum yazdı" };
    default:
      return { subject: entityName, text: item.action };
  }
}
