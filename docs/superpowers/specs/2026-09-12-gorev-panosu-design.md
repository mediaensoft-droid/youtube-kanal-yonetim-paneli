# C — Görev ve İş Planlama Panosu (Tasarım + Plan)

Tarih: 2026-09-12 · Kapsam: Website geliştirme maddesi **3** (+ madde 2'nin "atanan görevlerin kaçını tamamladı" kısmı)

## Amaç
Trello tarzı bir pano: sürüklenip bırakılabilen kartlar, düzenlenebilir sütunlar, atanan kişi, son
tarih, kanal bağlantısı, kontrol listesi ve yorumlar. Görev tamamlamaları hareket kaydına düşer ve
Yönetici'nin izleme panelinde kişi başına "atanan / tamamlanan" sayıları görünür.

## Yetkiler
- Görüntüleyici: panoyu görür, hiçbir şeyi değiştiremez.
- Düzenleyici / Vekil / Yönetici: sütun ve kart oluşturur, düzenler, taşır; kendine veya başkasına
  görev atar; yorum yazar; kontrol listesi işaretler.
- Kart silme: Yönetici + Vekil (`channel.delete` ile aynı seviye → yeni izin `task.delete`).
- Yeni izin adları: `task.write` (yonetici, vekil, duzenleyici), `task.delete` (yonetici, vekil).

## Veri modeli
`task_columns`: id, userId, name, position (0..n), createdAt. Varsayılan üç sütun her çalışma
alanı için ilk ziyarette oluşturulur: **Yapılacak**, **Devam Ediyor**, **Tamamlandı**. Bir sütun
`isDone INTEGER` (0/1) bayrağı taşır; "Tamamlandı" isDone=1. Karta isDone sütununa taşındığında
`completedAt` yazılır, çıkarılınca temizlenir.

`tasks`: id, userId, columnId, title, description (markdown düz metin), assigneeMemberId (null),
channelId (null, kanal silinince SET NULL), dueDate (YYYY-MM-DD, null), priority (`low`|`normal`|`high`),
position, checklist (JSON: `[{id, text, done}]`), createdByMemberId, completedAt, createdAt,
updatedAt.

`task_comments`: id, taskId (CASCADE), memberId (SET NULL), body, createdAt.

## Ekran: `/tasks` — "Görevler" (üst menüde herkes görür)
- Yatay kaydırılabilir sütunlar; sütun başlığı çift tıkla düzenlenir; "+ Sütun" sonda; sütun
  menüsü: Yeniden adlandır / Sola-sağa taşı / Sil (kartları ilk sütuna taşır; isDone tekse silinemez).
- Kart: başlık, öncelik rengi (sol kenar çizgisi), atanan kişinin baş harfi rozeti, son tarih
  (geçmişse kırmızı), kanal küçük görseli, kontrol listesi ilerlemesi (2/5), yorum sayısı.
- Sürükle-bırak: HTML5 drag & drop (kütüphane yok): kart → başka sütuna/pozisyona; sütunları
  taşımak menüden. Bırakınca `PATCH /api/tasks/[id]/move { columnId, position }`.
- Kart tıklanınca modal (body'ye portal!): başlık, açıklama, sütun, atanan (üye listesi), kanal
  (aktif+planlanan kanallar), son tarih, öncelik, kontrol listesi (ekle/işaretle/sil), yorumlar
  (liste + ekle), "Sil". Görüntüleyici için salt-okunur.
- Üst filtre çubuğu: Atanan (Tümü / Bana atananlar / üye), Kanal, Gecikmiş (toggle).
- Salt-okunur rol: sürükleme kapalı, formlar gizli.

## Hareket kaydı entegrasyonu
- `task.create`, `task.update` (changedFields), `task.move` (from → to sütun adı; hedef isDone ise
  ayrıca `task.complete`), `task.delete`, `task.comment`. `entityName` = görev başlığı.
- İzleme paneli kişi kartlarına iki sayı eklenir: **Atanan görev** (dönemde oluşturulmuş ve o
  kişiye atanmış görev sayısı — `tasks` tablosundan) ve **Tamamladı** (`task.complete` action
  sayısı). Filtre türü "Görev" `task.*` aksiyonlarını kapsar.

## API
- `GET /api/tasks/board` → `{ columns, tasks, members(id,displayName), channels(id,name,thumbnailUrl) }`
- `POST /api/tasks/columns`, `PATCH /api/tasks/columns/[id]` (name, position), `DELETE ...`
- `POST /api/tasks`, `PATCH /api/tasks/[id]`, `PATCH /api/tasks/[id]/move`, `DELETE /api/tasks/[id]`
- `POST /api/tasks/[id]/comments`, `GET` (modal açılınca)

## Kapsam dışı
Etiketler, ekler, tekrarlayan görevler, bildirimler, takvim entegrasyonu.

---

# Uygulama Planı

**Global constraints:** A/B planlarıyla aynı (Türkçe commit + iki trailer; idempotent migration;
prod env ile dev/build yok; `requirePermission("task.write" | "task.delete")`; modal ve menüler
`document.body`'ye portal).

### Task 1: Rol izinleri + şema + DB modülü
- `src/lib/roles.ts`: `task.write`, `task.delete` izinleri (matrix: yonetici hepsi; vekil write+delete;
  duzenleyici write; goruntuleyici yok). Testleri güncelle.
- `src/lib/db.ts`: üç tablo + indeksler (`(userId, columnId, position)`, `(taskId)`).
- `src/lib/db/tasks.ts`: `ensureDefaultColumns(userId)`, `listBoard(userId)`, `createColumn`,
  `updateColumn`, `deleteColumn` (kartları en düşük position'lı sütuna taşır), `createTask`,
  `updateTask`, `moveTask(userId, id, columnId, position)` (hedef sütundaki position'ları yeniden
  sıralar; isDone'a göre completedAt), `deleteTask`, `listComments`, `addComment`,
  `countAssignedTasks(userId, {from,to})` → Record<memberId,count>.
- Türler `src/types/index.ts`: `TaskColumn`, `Task`, `TaskComment`, `ChecklistItem`.

### Task 2: API rotaları + hareket kaydı
- Yukarıdaki rotalar; zod şemaları `src/lib/validation.ts` (`createTaskSchema`, `updateTaskSchema`,
  `moveTaskSchema`, `columnSchema`, `commentSchema`; checklist item `{id: string, text: 1..200, done: boolean}`).
- `src/lib/activity.ts`: `task.*` aksiyonları, etiketler, cümleler ("**X** görevini oluşturdu",
  "**X** görevini Tamamlandı sütununa taşıdı", "**X** görevini tamamladı", "**X** görevine yorum yazdı").
- İzleme paneli: `summarizeActivity` sonucuna `countAssignedTasks` eklenir; `ActivityClient` kişi
  kartlarında "Atanan görev" ve "Tamamladı" sayıları; filtre türü "Görev".

### Task 3: Pano arayüzü
- `src/app/tasks/page.tsx` (+loading) → `getSessionActor` → `ensureDefaultColumns` → `listBoard`
  → `<TaskBoard initial… readOnly canDelete />`.
- `src/app/tasks/TaskBoard.tsx` (pano + DnD + filtreler), `TaskCard.tsx`, `TaskModal.tsx`
  (portal), `ColumnMenu.tsx` (portal). Optimistic taşıma + hata durumunda geri alma + toast.
- Nav: "Görevler" (`ClipboardList` ikonu) Takvim'den sonra, tüm roller.

### Task 4: Doğrulama + deploy
- tsc/eslint/test/build; taze DB migration; merge + push; canlıda: sütunlar oluşmuş mu, kart ekle,
  sürükle, tamamla → `/team/activity`'de "tamamladı" satırı ve kişi kartında sayı.
