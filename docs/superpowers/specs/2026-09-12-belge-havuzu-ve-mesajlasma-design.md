# F — Belge Havuzu · G — Ekip Mesajlaşması (Tasarım + Plan)

Tarih: 2026-09-12 · Kapsam: Website geliştirme maddeleri **9** ve **8**

Depolama: Vercel Blob (`@vercel/blob`, profil fotoğrafında zaten kullanılıyor; `BLOB_READ_WRITE_TOKEN`
prod'da tanımlı). Dosyalar `access: "public"` ile saklanır ancak URL tahmin edilemez (Blob rastgele
son ek ekler) — uygulama içinde yalnızca oturum açmış kullanıcıya listelenir. Yükleme sunucu üzerinden
`formData` ile; dosya başına üst sınır **25 MB** (Vercel fonksiyon gövdesi 100 MB'a kadar).
İzin verilen türler: pdf, doc/docx, xls/xlsx, ppt/pptx, txt, md, csv, png, jpg, webp, gif, mp4, mp3,
zip. Yeni izinler: `files.write` (yonetici, vekil, duzenleyici), `files.delete` (yonetici, vekil).

---

## F — Belge Havuzu (madde 9) — `/files` "Belgeler"

### Veri
`doc_folders`: id, userId, parentId (null = kök, CASCADE), name, createdByMemberId, createdAt.
`doc_files`: id, userId, folderId (null = kök, SET NULL), name (görünen ad), blobUrl, blobPathname,
size, contentType, description (isteğe bağlı kısa açıklama), uploadedByMemberId, createdAt.
İndeksler `(userId, folderId)`.

### Ekran
- Üstte breadcrumb (Belgeler / Klasör / Alt klasör), arama kutusu (ad + açıklama, mevcut klasörde
  ve altında), "Klasör oluştur" ve "Dosya yükle" (files.write).
- Liste: klasörler önce (ikon + ad + öğe sayısı), sonra dosyalar (tür ikonu, ad, boyut, yükleyen,
  tarih). Satır işlemleri: İndir (yeni sekme, herkes), Yeniden adlandır / Taşı (files.write),
  Sil (files.delete, onaylı; klasör silme içeriğiyle birlikte — onay metninde belirtilir).
- Sürükle-bırak yükleme alanı (dropzone) + ilerleme; çoklu dosya seçimi.
- Boş durum: "Bu klasör boş."
- "Önemli bilgiler" için ayrı bir yapı gerekmez: metin notları `.md`/`.txt` olarak yüklenir ya da
  klasör açıklaması kullanılır (YAGNI).

### API
- `GET /api/files?folderId=` → `{ folders, files, breadcrumb }`; `GET /api/files/search?q=`.
- `POST /api/files/folders`, `PATCH /api/files/folders/[id]` (name, parentId), `DELETE` (içerik dahil;
  Blob'dan `del`).
- `POST /api/files` (formData: file, folderId?, description?) → Blob `put` → kayıt; `PATCH /api/files/[id]`
  (name, folderId, description); `DELETE /api/files/[id]` (Blob `del`).
- Hareket kaydı: `file.upload`, `file.delete`, `folder.create`, `folder.delete` (entityName = ad).

---

## G — Ekip Mesajlaşması (madde 8) — `/messages` "Mesajlar"

### Veri
`conversations`: id, userId, type (`general` | `dm`), memberAId (dm), memberBId (dm, A<B sıralı),
createdAt. Her çalışma alanı için bir `general` sohbet ilk ziyarette oluşturulur.
`messages`: id, conversationId (CASCADE), memberId (SET NULL), body (boş olabilir, ek varsa),
attachmentUrl, attachmentName, attachmentSize, attachmentType, createdAt. İndeks `(conversationId, id)`.
`conversation_reads`: conversationId, memberId, lastReadMessageId, PK(conversationId, memberId).

### Ekran
- Sol: "Genel" + üye listesi (birebir); her satırda okunmamış sayısı rozeti. Pasif üyeler listelenmez
  ama eski DM'ler açılabilir.
- Sağ: mesaj akışı (gün ayraçları, gönderen adı + saat, metin, ek dosya kartı — görselse önizleme,
  değilse ad + boyut + indir), altta yazma kutusu (Enter gönder, Shift+Enter satır), ataç butonu
  (25 MB), gönderim sırasında ilerleme.
- Yenileme: **polling** — açık sohbet 4 sn'de bir `GET /api/messages/[conversationId]?after=<lastId>`,
  sol liste ve Nav rozeti 15 sn'de bir `GET /api/messages/unread`. Sekme gizliyse polling durur
  (`document.visibilityState`).
- Nav: "Mesajlar" (`MessageSquare`) + okunmamış toplam rozeti (tüm roller).
- Görüntüleyici de mesaj gönderebilir (iletişim işlem değildir); silme yok (v1).

### API
- `GET /api/messages/conversations` → liste + okunmamış sayıları (Genel + her üye için DM id'si —
  DM yoksa `null`, ilk mesajda oluşturulur `POST /api/messages/conversations { memberId }`).
- `GET /api/messages/[conversationId]?after=&before=` (50'şer, `after` ile artımlı), okundu işareti
  `POST /api/messages/[conversationId]/read { lastReadMessageId }`.
- `POST /api/messages/[conversationId]` (JSON `{ body }` veya formData `file` + `body`).
- `GET /api/messages/unread` → `{ total, byConversation }`.
- Yetki: sohbet üyeliği (general: herkes; dm: yalnızca iki taraf) sunucuda doğrulanır.
- Hareket kaydı: yok (özel iletişim).

---

# Uygulama Planı

**Global constraints:** önceki planlarla aynı; Blob `put` için `@vercel/blob`; dosya tür/boyut
doğrulaması sunucuda; portal kuralı.

### Task F1: İzinler + şema + DB + API (belgeler)
### Task F2: `/files` ekranı + Nav
### Task G1: Şema + DB + API (mesajlar) — ortak `src/lib/uploads.ts` (tür/boyut doğrulama, Blob put/del) F1'de yazılır, G1 kullanır
### Task G2: `/messages` ekranı + Nav rozeti + polling
### Task FG3: Doğrulama + deploy
