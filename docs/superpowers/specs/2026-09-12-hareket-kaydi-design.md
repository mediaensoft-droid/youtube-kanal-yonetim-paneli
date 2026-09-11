# B — Hareket Kaydı ve Personel İzleme Paneli (Tasarım + Plan)

Tarih: 2026-09-12 · Kapsam: Website geliştirme maddesi **2** (ve madde 4'ün "yönetici panelde ayrıca görsün" kısmı)

## Amaç
Personelin (Vekil / Düzenleyici / Görüntüleyici — ve Yönetici'nin kendisi) uygulamada yaptığı her
önemli işlemi kim-ne-ne zaman olarak kaydetmek ve Yönetici'ye sadece kendisinin görebildiği bir
izleme paneli sunmak: kişi bazlı günlük/haftalık akış, özet sayılar (kaç kanal ekledi, kaç
düzenleme yaptı, kaç kanalı pasife aldı, takvimde kaç değişiklik, kaç giriş) ve ileride (C) görev
tamamlama sayıları.

## Veri modeli
Yeni tablo `activity_log`:

| sütun | açıklama |
|---|---|
| id | PK |
| userId | çalışma alanı (users.id), CASCADE |
| memberId | işlemi yapan üye (members.id), SET NULL |
| action | aşağıdaki sabit listeden biri |
| entityType | `channel` \| `category` \| `concept` \| `schedule` \| `member` \| `auth` \| `task` (C'de) |
| entityId | ilgili kaydın id'si (null olabilir) |
| entityName | o anki ad (kanal adı, kategori adı, üye adı) — kayıt silinse de okunur kalsın |
| details | JSON metin: ör. `{"changedFields":["categoryIds","notes"]}`, `{"from":"active","to":"passive"}`, `{"date":"2026-09-12","status":"published"}` |
| createdAt | |

İndeksler: `(userId, createdAt)`, `(userId, memberId, createdAt)`.

`action` sabitleri (`src/lib/activity.ts`, saf modül; Türkçe etiket + cümle şablonu ile):

| action | etiket | cümle |
|---|---|---|
| `channel.create` | Kanal ekledi | "**{entityName}** kanalını ekledi" (details.status = planned ise "planlanan kanal olarak ekledi") |
| `channel.update` | Kanal düzenledi | "**{entityName}** kanalını düzenledi ({alan listesi})" |
| `channel.status` | Kanal durumu değiştirdi | "**{entityName}** kanalını {pasife aldı / aktife aldı / planlanana taşıdı}" |
| `channel.delete` | Kanal sildi | "**{entityName}** kanalını sildi" |
| `channel.refresh` | Kanal yeniledi | "**{entityName}** kanalının YouTube verilerini yeniledi" |
| `category.create/update/delete` | Kategori ekledi/düzenledi/sildi | "**{entityName}** kategorisini ..." |
| `concept.create/update/delete` | Konsept ... | |
| `schedule.upsert` | Takvim kaydı | "**{entityName}** için {date} tarihini {status} yaptı" |
| `schedule.delete` | Takvim kaydı sildi | |
| `schedule.pattern` | Yayın günleri | "**{entityName}** kanalının {yearMonth} yayın günlerini değiştirdi" |
| `member.create/update/password/status` | Personel ... | "**{entityName}** adlı personeli ekledi / düzenledi / şifresini sıfırladı / pasife aldı" |
| `auth.login` | Giriş yaptı | "sisteme giriş yaptı" |
| `account.update/password` | Hesabını güncelledi | |

Türkçe alan adları (channel.update için): categoryIds→kategoriler, conceptIds→konseptler,
languages→diller, countries→ülkeler, notes→notlar, publishDays→yayın günleri, publishTime→yayın
saati, url→URL, aiTools→yapay zeka araçları (E'de gelecek).

## Kayıt noktaları
`logActivity(actor, entry)` (`src/lib/db/activity.ts`) — hata fırlatmaz (try/catch, `console.error`);
ana işlem asla log yüzünden bozulmaz.

- `POST /api/channels` → channel.create (status)
- `PATCH /api/channels/[id]` → alan farkı varsa channel.update (changedFields); status değiştiyse
  ayrıca channel.status (from/to)
- `DELETE /api/channels/[id]` → channel.delete
- `POST /api/channels/[id]/refresh` → channel.refresh
- categories/concepts POST/PATCH/DELETE
- `POST /api/schedule` → schedule.upsert (date, status, kanal adı), `DELETE /api/schedule/[id]`
- `POST /api/channel-month-patterns` → schedule.pattern
- `/api/team*` → member.create / member.update (rol/ad) / member.status / member.password
- `/api/account*` → account.update / account.password
- Personel girişi: `authorize()` başarıda auth.login (memberId = üye). Google girişi (Yönetici)
  için de `jwt` callback'te `user` mevcutken auth.login.

## Panel: `/team/activity` (yalnızca Yönetici)
- `/team` üstünde sekme şeridi: **Personel | Hareketler** (ChannelsTabs ile aynı görünüm).
- Filtreler: Kişi (Tümü / her üye), Dönem (Bugün / Son 7 gün / Son 30 gün / Özel aralık), İşlem
  türü (Tümü / Kanal / Kategori-Konsept / Takvim / Personel / Giriş / Görev).
- Üstte kişi kartları: seçili dönemde her üye için sayılar — Kanal ekledi · Düzenledi · Pasife
  aldı · Sildi · Takvim değişikliği · Giriş. (Görev tamamlama sayısı C ile eklenecek.)
- Altta zaman akışı: gün başlıkları altında satırlar — saat · üye adı · cümle · (varsa) kanal
  bağlantısı. Sayfalama: "Daha fazla" (50'şer).
- Veri: `GET /api/activity?memberId=&from=&to=&type=&cursor=` → `{ items, summary, nextCursor }`.

## Kapsam dışı
Görev sayıları (C), dışa aktarma, bildirim.

---

# Uygulama Planı

**Global constraints:** aynı A planı (Türkçe commit + iki trailer; migration idempotent; prod
env ile dev/build çalıştırma; `requirePermission("team.manage")` panel ve API için).

### Task 1: Saf `activity` modülü + testler
- Create `src/lib/activity.ts`: `ActivityAction` union (yukarıdaki liste), `ACTIVITY_TYPES`
  (filtre grupları: `channel|taxonomy|schedule|member|auth|task` → action listesi), `ACTION_LABELS`,
  `FIELD_LABELS`, `describeActivity(item): string` (cümle; entityName'i düz metin döner, UI kalın yapar
  → daha basit: `{ subject: entityName | null, text: string }` döner).
- Test `src/lib/__tests__/activity.test.ts`: channel.update details.changedFields → "kanalını düzenledi (kategoriler, notlar)"; channel.status to passive → "pasife aldı"; auth.login → "sisteme giriş yaptı"; bilinmeyen action → action string'i.

### Task 2: Şema + DB modülü + log çağrıları
- `src/lib/db.ts`: `activity_log` tablosu + indeksler (members'tan sonra).
- `src/lib/db/activity.ts`: `logActivity(actor: {workspaceId, memberId}, entry: {action, entityType, entityId?, entityName?, details?})` (never throws), `listActivity(userId, {memberId?, from?, to?, actions?, cursor?, limit=50})` → `{ items, nextCursor }` (cursor = last id, `id < cursor` ile), `summarizeActivity(userId, {from,to})` → `Record<memberId, Record<action, count>>`.
- Türler `src/types/index.ts`: `ActivityItem { id, memberId, memberName (join), action, entityType, entityId, entityName, details: Record<string,unknown>, createdAt }`.
- Log çağrıları: yukarıdaki "Kayıt noktaları" listesi, tüm rotalar. `PATCH /api/channels/[id]`: `changedFields` hesabı — `manualFields` içindeki her anahtar için `JSON.stringify(existing[key]) !== JSON.stringify(value)` ise ekle.
- Auth: `authorize()` başarı → `logActivity({workspaceId: member.userId, memberId: member.id}, {action:"auth.login", entityType:"auth"})`; Google jwt dalında owner için aynısı (sadece `user` varken, yani gerçek girişte).

### Task 3: API + panel
- `GET /api/activity` (team.manage): query parse (zod: memberId int optional, from/to ISO date optional, type enum optional, cursor int optional) → `listActivity` + `summarizeActivity`.
- `src/app/team/layout.tsx`? Hayır — `/team` sayfası zaten var; `src/app/team/TeamTabs.tsx` (client, ChannelsTabs kopyası: Personel `/team`, Hareketler `/team/activity`) ve iki sayfada başlığın altına yerleştir. `TeamClient` başlığı korunur.
- `src/app/team/activity/page.tsx` (requirePageRole team.manage; `listMembers` → filtre için) + `ActivityClient.tsx`: filtreler, kişi kartları (summary'den), akış, "Daha fazla". Tarih/saat: `Intl.DateTimeFormat("tr-TR", { hour:"2-digit", minute:"2-digit" })`, gün başlığı `formatDate`.
- Varsayılan dönem: Son 7 gün.

### Task 4: Doğrulama + deploy
- tsc/eslint/test/build; taze DB migration; main'e merge + push; prod'da `activity_log` var mı;
  canlıda bir kanal düzenleyip `/team/activity`'de satırı gör.
