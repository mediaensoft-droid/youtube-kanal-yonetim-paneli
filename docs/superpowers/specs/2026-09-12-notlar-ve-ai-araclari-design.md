# D — Kişisel Notlar · E — Kanal Yapay Zeka Araçları (Tasarım + Plan)

Tarih: 2026-09-12 · Kapsam: Website geliştirme maddeleri **6** ve **7**

---

## D — Kişisel Notlar (madde 6)

### Kurallar
- Her üyenin (Yönetici dahil) kendine ait notları vardır.
- **Yönetici** tüm personelin notlarını **okuyabilir** (düzenleyemez); Yönetici'nin notlarını
  hiç kimse göremez (Vekil dahil).
- Personel yalnızca kendi notlarını görür/düzenler. Notlar hareket kaydına **yazılmaz** (özel).

### Veri modeli
`notes`: id, userId (çalışma alanı, CASCADE), memberId (members.id, CASCADE), title (boş
olabilir), body (metin), pinned (0/1), createdAt, updatedAt. İndeks `(userId, memberId, updatedAt)`.

### Ekran: `/notes` — "Notlarım" (üst menüde herkes, `StickyNote` ikonu, Takvim'den sonra)
- Sol: not listesi (sabitlenenler üstte, sonra updatedAt DESC), arama kutusu, "+ Yeni not".
- Sağ: seçili notun başlık + gövde editörü (textarea, düz metin). **Otomatik kaydetme**: 800 ms
  debounce ile `PATCH`; sağ üstte "Kaydedildi · 12:41" / "Kaydediliyor…" durumu. Sabitle ve Sil
  (onaylı) butonları.
- Yönetici için üstte bir `<Select>`: "Notlar: Benim / <personel adı>…". Personel seçilince liste
  ve editör **salt-okunur** (badge: "Salt okunur — X'in notları").
- Boş durum: "Henüz not yok. İlk notunu oluştur."

### API
- `GET /api/notes?memberId=` → kendi notları; `memberId` verilirse yalnızca Yönetici ve yalnızca
  personel (rolü yonetici olmayan) üyeler için; aksi 403.
- `POST /api/notes` → `{ title?, body? }` (kendi adına). `PATCH /api/notes/[id]` → `{ title?, body?, pinned? }`;
  `DELETE /api/notes/[id]`. Not sahibi olmayan herkes (Yönetici dahil) yazma uçlarında 403.
- Şemalar: title ≤ 200, body ≤ 50.000 karakter.

---

## E — Kanal Yapay Zeka Araçları (madde 7)

### Katalog
`src/lib/aiTools.ts` (saf): `AI_TOOL_CATEGORIES` ve `AI_TOOLS: { id, name, url, category }[]`.
Logo: `https://www.google.com/s2/favicons?sz=64&domain=<alan adı>` (harici görsel; yüklenemezse
baş harf rozeti). `toolLogoUrl(tool)` yardımcı fonksiyonu.

Kategoriler ve araçlar (kullanıcı ek isterse listeye satır eklenir):
- **Video üretimi:** Runway (runwayml.com), Pika (pika.art), Luma Dream Machine (lumalabs.ai),
  Kling (klingai.com), Sora (openai.com), Google Veo (deepmind.google), Hailuo (hailuoai.video),
  Vidu (vidu.com), Higgsfield (higgsfield.ai), Hedra (hedra.com), InVideo AI (invideo.io),
  Pictory (pictory.ai), Fliki (fliki.ai)
- **Avatar / sunucu:** HeyGen (heygen.com), Synthesia (synthesia.io), D-ID (d-id.com), Captions (captions.ai)
- **Görsel üretimi:** Midjourney (midjourney.com), ChatGPT Images / DALL·E (openai.com), Stable
  Diffusion (stability.ai), Leonardo AI (leonardo.ai), Ideogram (ideogram.ai), Adobe Firefly
  (firefly.adobe.com), Flux (bfl.ai), Krea (krea.ai), Recraft (recraft.ai), Freepik AI (freepik.com), Canva (canva.com)
- **Seslendirme / TTS:** ElevenLabs (elevenlabs.io), Murf (murf.ai), Play.ht (play.ht), Speechify
  (speechify.com), Fish Audio (fish.audio), Resemble AI (resemble.ai), WellSaid (wellsaidlabs.com),
  Google Cloud TTS (cloud.google.com), Azure Speech (azure.microsoft.com), OpenAI TTS (openai.com)
- **Müzik / ses efekti:** Suno (suno.com), Udio (udio.com), AIVA (aiva.ai), Soundraw (soundraw.io),
  Mubert (mubert.com), Stable Audio (stableaudio.com)
- **Senaryo / metin (LLM):** ChatGPT (chatgpt.com), Claude (claude.ai), Gemini (gemini.google.com),
  Perplexity (perplexity.ai), Grok (grok.com), DeepSeek (deepseek.com), Microsoft Copilot
  (copilot.microsoft.com), Jasper (jasper.ai), Notion AI (notion.so)
- **Kurgu / düzenleme:** CapCut (capcut.com), Descript (descript.com), Adobe Premiere Pro (adobe.com),
  DaVinci Resolve (blackmagicdesign.com), Opus Clip (opus.pro), VEED (veed.io), Kapwing (kapwing.com),
  Filmora (filmora.wondershare.com), Submagic (submagic.co), Vizard (vizard.ai), Remotion (remotion.dev)
- **Altyazı / çeviri / dublaj:** Whisper (openai.com), DeepL (deepl.com), Rask AI (rask.ai),
  ElevenLabs Dubbing (elevenlabs.io), HeyGen Translate (heygen.com)
- **Küçük resim / tasarım:** Canva, Adobe Photoshop (adobe.com), Thumbnail AI (thumbnail.ai), Ideogram
- **Araştırma / SEO / analiz:** vidIQ (vidiq.com), TubeBuddy (tubebuddy.com), NexLev (nexlev.io),
  Gling (gling.ai), Google Trends (trends.google.com)
- **Otomasyon:** Make (make.com), n8n (n8n.io), Zapier (zapier.com)

(Aynı araç birden fazla kategoride yer alabilir; `id` benzersiz, ör. `heygen`, `heygen-translate`.)

### Veri
`channels.aiTools TEXT NOT NULL DEFAULT '[]'` — araç id dizisi. `Channel.aiTools: string[]`.
Migration: diğer sütunlar gibi ALTER + duplicate-column toleransı; base CREATE ve channels_new
rebuild'e de eklenir.

### Arayüz
- Kanal ekle/düzenle formu: "Yapay Zeka Araçları" alanı — `MultiSelect` (kategori başlıklı liste,
  seçeneklerde logo). `MultiSelect` `MultiSelectOption.iconUrl?: string` ve `group?: string`
  (grup başlığı) desteği kazanır.
- Kanal kartı ve liste satırı: seçili araçların logoları küçük (16 px) yan yana, en fazla 6 + "+N";
  logoya tıklayınca yeni sekmede aracın sitesi açılır (`stopPropagation`; kart tıklaması YouTube'a
  gider, onu bozma).
- Kanal detayı: "Yapay Zeka Araçları" bölümü — logo + ad, kategori rozeti; tıklanınca yeni sekme.
- Kanallar listesi filtreleri: "Tüm araçlar" `<Select>` (aracı içeren kanallar).
- Hareket kaydı: `FIELD_LABELS.aiTools = "yapay zeka araçları"`; API `updateChannelSchema` /
  `createChannelSchema`: `aiTools: z.array(z.string()).optional()` — bilinmeyen id'ler 400.

---

# Uygulama Planı

**Global constraints:** önceki planlarla aynı (Türkçe commit + iki trailer; idempotent migration;
prod env ile dev/build yok; modal/menü portal).

### Task D1: Notlar — şema, DB, API
- `db.ts` `notes` tablosu; `src/lib/db/notes.ts`: `listNotes(userId, memberId)`, `getNote`,
  `createNote`, `updateNote`, `deleteNote`; `validation.ts` şemaları; `/api/notes` rotaları
  (yetki kuralları yukarıda; okuma `requireActor`, başkasının notları için `actor.role === "yonetici"`
  ve hedef üye `role !== "yonetici"` kontrolü).

### Task D2: Notlar — ekran
- `/notes` sayfası + `NotesClient.tsx` (liste + editör + autosave + Yönetici için üye seçici),
  Nav'a "Notlarım".

### Task E1: AI araçları — katalog, şema, API, form
- `src/lib/aiTools.ts` + test (id benzersizliği, her aracın url'si https ile başlar, kategori geçerli).
- `channels.aiTools` migration + tip + DB (create/update alanları) + validation + `FIELD_LABELS`.
- `MultiSelect` `iconUrl`/`group`; `ChannelForm` alanı.

### Task E2: AI araçları — görünüm
- Kart + satır logoları (`ChannelAiToolLogos` ortak bileşen), detay bölümü, liste filtresi.

### Task DE3: Doğrulama + deploy
