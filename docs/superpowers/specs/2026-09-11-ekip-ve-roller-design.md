# A — Ekip & Roller (Tasarım)

Tarih: 2026-09-11 · Kapsam: Website geliştirme maddeleri **1, 4, 5**

## Amaç

Ana hesabın (Google ile giren kullanıcı) altında kullanıcı adı + şifreyle giren personel hesapları
oluşturmak; dört rolle (Yönetici / Vekil / Düzenleyici / Görüntüleyici) yetkileri sınırlamak; kanalı
kimin eklediğini ve kimin pasife aldığını kaydedip göstermek; kanal silmeyi Yönetici ve Vekil'e
kısıtlamak. Bu paket, sonraki adımların (hareket kaydı, görev panosu, notlar, mesajlaşma) "kim"
bilgisini sağlayan temeldir.

## Kavramlar

- **Çalışma alanı (workspace)**: Bugünkü `users` satırı. Tüm veriler (kanallar, kategoriler, takvim,
  üyelik) zaten `userId` ile bu hesaba bağlı; bu değişmiyor. Çalışma alanının sahibi = Yönetici.
- **Üye (member)**: Çalışma alanında işlem yapan kişi. Sahip de dahil herkes bir üye kaydıdır:
  - Sahip: rolü `yonetici`, Google ile girer, kullanıcı adı/şifresi yoktur (kayıt otomatik oluşur).
  - Personel: rolü `vekil` | `duzenleyici` | `goruntuleyici`, kullanıcı adı + şifreyle girer.
- **Aktör**: Oturumdaki üye. Her API isteğinde `{ workspaceId, memberId, role }` bilinir.

## Roller ve yetki matrisi

| İşlem | Yönetici | Vekil | Düzenleyici | Görüntüleyici |
|---|---|---|---|---|
| Sayfalarda gezinme, kanal/takvim/dashboard görüntüleme | ✓ | ✓ | ✓ | ✓ |
| Kanal ekleme, düzenleme, yenileme, pasife/aktife alma, planlanan ekleme | ✓ | ✓ | ✓ | — |
| Kategori / konsept ekleme-düzenleme-silme | ✓ | ✓ | ✓ | — |
| Takvim: plan/yayın durumu değiştirme, yayın günleri | ✓ | ✓ | ✓ | — |
| **Kanal silme** | ✓ | ✓ | — | — |
| Personel yönetimi (ekle / düzenle / rol / şifre sıfırla / pasife al) | ✓ | — | — | — |
| Yönetici profili (`/profile`), Üyelik & ödeme (`/billing`) | ✓ | — | — | — |
| Kendi hesabı: görünen ad ve şifre değiştirme (`/account`) | — (profil sayfası var) | ✓ | ✓ | ✓ |

Kurallar iki katmanda uygulanır:
1. **Sunucu (asıl güvenlik)**: Her API rotası `requirePermission("channel.delete")` gibi bir kontrolle
   başlar; yetkisiz istek `403` döner. Sayfalar da yetkisiz rolleri ana sayfaya yönlendirir.
2. **Arayüz (kolaylık)**: Yetkisi olmayan rol için ilgili buton/menü hiç çizilmez (ör. Görüntüleyici
   hiç "Kanal Ekle", kalem, çöp, göz ikonu görmez; Düzenleyici çöp ikonu görmez).

## Veri modeli

Yeni tablo `members`:

| sütun | açıklama |
|---|---|
| id | PK |
| userId | çalışma alanı (users.id), CASCADE |
| role | `yonetici` \| `vekil` \| `duzenleyici` \| `goruntuleyici` |
| displayName | ekranda görünen ad |
| username | küçük harf, 3–30 karakter, `a-z 0-9 . _ -`; **tüm sistemde benzersiz** (sahipte NULL) |
| passwordHash | bcrypt; sahipte NULL |
| status | `active` \| `disabled` (pasif personel giriş yapamaz) |
| lastLoginAt, createdAt, updatedAt | |

`channels` tablosuna eklenen sütunlar:

| sütun | açıklama |
|---|---|
| createdByMemberId | kanalı ekleyen üye (mevcut kanallar → o çalışma alanının sahibi ile doldurulur) |
| statusChangedByMemberId | son durum değişikliğini (pasif/aktif/planlanan→aktif) yapan üye |
| statusChangedAt | son durum değişikliği zamanı |

Migration: mevcut her `users` satırı için otomatik bir `yonetici` üye kaydı oluşturulur; mevcut
kanallarda `createdByMemberId` bu kayda bağlanır. Mevcut pasif kanallarda "pasife alan" bilgisi
yoktur ve "—" gösterilir.

## Kimlik doğrulama

- NextAuth'a **Credentials** sağlayıcı eklenir: `username` + `password`. Doğrulama: `members`
  tablosunda kullanıcı adı + bcrypt karşılaştırması, `status = active` ve çalışma alanının
  üyeliğinin geçerli olması (`hasActiveAccess`). Başarılı girişte `lastLoginAt` güncellenir.
- Google girişi aynen kalır; sahip için üye kaydı yoksa oluşturulur.
- JWT içinde: `userId` (çalışma alanı), `memberId`, `role`. `session.user.id` **çalışma alanı id'si
  olarak kalır** → mevcut tüm sorgular ve `getSessionUserId()` değişmeden çalışır. Yeni
  `getSessionActor()` üye ve rolü verir.
- Giriş sayfası: Google butonunun altında "Personel girişi" bölümü (kullanıcı adı, şifre). Hatalı
  girişte genel mesaj ("Kullanıcı adı veya şifre hatalı"); pasif hesapta "Hesabınız pasif".
- Şifre kuralı: en az 8 karakter. Şifreler yalnızca hash olarak saklanır; Yönetici bile mevcut
  şifreyi göremez, sadece **yeni şifre belirleyebilir**.

## Ekranlar

### `/team` — Personel (yalnızca Yönetici)
- Üst menüde "Personel" bağlantısı (sadece Yönetici görür).
- Liste: görünen ad, kullanıcı adı, rol rozeti, durum, son giriş.
- "Personel Ekle": görünen ad, kullanıcı adı (benzersizlik anında kontrol), şifre, rol.
- Satır işlemleri: düzenle (ad, rol), şifre sıfırla (yeni şifre gir), pasife al / aktife al.
- Bu sürümde üye **silme yok**, sadece pasife alma var: üyenin eklediği kanallar ve ileride
  hareket kayıtları "Ekleyen: <ad>" bilgisiyle bozulmadan kalır.

### `/account` — Hesabım (personel)
- Görünen adını ve şifresini (mevcut şifre + yeni şifre) değiştirir.
- Üst menüde profil avatarı yerine görünen ad baş harfi; tıklayınca `/account`.
- Yönetici için bu sayfa yok; mevcut `/profile` kullanılır.

### Kanal detayı (madde 4)
- Başlık kartında: **Ekleyen:** görünen ad · tarih.
- Pasif kanalda: **Pasife alan:** görünen ad · tarih. Planlanan/aktif geçişlerinde de aynı alan
  "Son durum değişikliği" olarak gösterilir.
- Kart ve liste satırında gösterilmez (kalabalık olmasın); ileride izleme paneli bunu toplu verir.

### Menü ve sayfa görünürlüğü
- Vekil/Düzenleyici/Görüntüleyici: "Üyelik" ve "Profil" menüde yok; `/billing`, `/profile`,
  `/team` doğrudan açılırsa ana sayfaya yönlenir.
- Görüntüleyici: tüm yazma butonları gizli; takvim hücreleri tıklanamaz (sadece bakar).

## API

- `POST /api/auth/[...nextauth]` (mevcut) — Credentials sağlayıcı eklenir.
- `GET/POST /api/team` — üye listesi / yeni üye (Yönetici).
- `PATCH /api/team/[id]` — ad, rol, durum; `POST /api/team/[id]/password` — yeni şifre (Yönetici).
- `PATCH /api/account` — kendi adı; `POST /api/account/password` — kendi şifresi (personel).
- Mevcut rotalar: `channels`, `categories`, `concepts`, `schedule`, `channel-month-patterns`
  yazma uçlarına `requirePermission` eklenir; `DELETE /api/channels/[id]` → `channel.delete`
  (Yönetici, Vekil). Kanal oluşturma `createdByMemberId`, durum değişimi
  `statusChangedByMemberId/At` yazar.

## Hata durumları
- Yanlış şifre/kullanıcı: 401, genel mesaj.
- Pasif üye girişi: reddedilir ("Hesabınız pasif, yöneticinize başvurun").
- Çalışma alanının üyeliği bitmişse personel de giriş yapamaz (sahibin gördüğü mesajın aynısı).
- Yetkisiz API isteği: 403 `"Bu işlem için yetkiniz yok"`; arayüzde toast.
- Kullanıcı adı çakışması: 409 `"Bu kullanıcı adı kullanımda"`.

## Test / doğrulama
- Tip kontrolü, lint, build lokalde. Migration (members oluşturma + createdBy backfill) prod'a
  bağlanmadan yerel SQLite ile denenir.
- Canlıda: Yönetici olarak personel oluştur → gizli pencerede kullanıcı adı/şifreyle gir → rol
  başına buton görünürlüğü ve API 403'leri (Görüntüleyici ile kanal ekleme denemesi vb.).

## Kapsam dışı (sonraki adımlar)
- Hareket kaydı ve izleme paneli (B), görevler (C), notlar (D), personel sayısı plan limiti.
