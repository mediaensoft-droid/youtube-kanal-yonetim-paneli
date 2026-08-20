# YouTube Kanal Yönetim Paneli

Next.js (App Router) + Tailwind CSS + `@libsql/client` (SQLite/Turso) + Recharts ile geliştirilmiş bir YouTube kanal takip/yönetim paneli.

## Kurulum (yerel geliştirme)

1. Bağımlılıkları kurun:

   ```bash
   npm install
   ```

2. `.env.local` dosyasına YouTube Data API v3 anahtarınızı ekleyin:

   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

   Anahtar [Google Cloud Console](https://console.cloud.google.com/apis/credentials) üzerinden, "YouTube Data API v3" etkinleştirilmiş bir projede oluşturulabilir.

   `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` yerelde **gerekli değildir** — boş bırakılırsa uygulama otomatik olarak `data/app.db` yerel dosyasını kullanır.

3. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) adresini açın.

## Özellikler

- **Dashboard** (`/`): toplam kanal sayısı, kategori/konsept/dil/ülke dağılım grafikleri.
- **Kanallar** (`/channels`): Büyük/Küçük/Liste görünümleri, kategori/konsept/dil/ülke filtreleri, arama; her kart YouTube URL'sini yeni sekmede açar; "Yenile" butonu ile abone/video sayısı YouTube'dan tekrar çekilir.
- **Kanal Ekle** (`/channels/new`): YouTube URL'si veya kanal ID'si girilir, ad/thumbnail/istatistikler otomatik çekilir; kategori, konsept, diller ve hedef ülkeler manuel seçilir.
- **Kanal Detayı** (`/channels/[id]`): kanal açıklaması, katılım tarihi, ortalama izlenme, yükleme sıklığı, son videolar, **abone/görüntülenme büyüme trendi grafiği**.
- **Kategoriler** (`/categories`) / **Konseptler** (`/concepts`): ekle/düzenle/sil, renk seçimi.
- **Otomatik günlük yenileme**: Vercel Cron ile her gün tüm kanalların istatistikleri otomatik çekilip bir "anlık görüntü" (snapshot) olarak kaydedilir — trend grafiklerinin verisi buradan gelir. Manuel "Yenile" butonu da her tıklamada bir anlık görüntü ekler.

## Veri Katmanı

Veritabanı bağlantısı [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts) ile yönetilir (`src/lib/db.ts`):

- **`TURSO_DATABASE_URL`** ortam değişkeni **tanımlı değilse** (yerel geliştirme), `data/app.db` adlı yerel bir SQLite dosyası kullanılır — bu dosya `.gitignore` ile hariç tutulur.
- **`TURSO_DATABASE_URL`** tanımlıysa (production/Vercel), uzak bir [Turso](https://turso.tech) veritabanına bağlanılır.

> Neden Turso? Vercel gibi sunucusuz (serverless) platformlarda dosya sistemi kalıcı değildir — yerel bir SQLite dosyası her istekte sıfırlanabilir. Turso, SQLite ile bire bir uyumlu, ücretsiz katmanı olan bulut tabanlı bir servistir; kod tarafında sadece bağlantı katmanı değişir, SQL sorguları aynı kalır.

### Turso kurulumu (production için)

1. [turso.tech](https://turso.tech) adresinden ücretsiz bir hesap açın (GitHub ile giriş yapılabilir).
2. Turso CLI ile (veya web dashboard'dan) bir veritabanı oluşturun:
   ```bash
   turso db create youtube-kanal-paneli
   turso db show youtube-kanal-paneli --url
   turso db tokens create youtube-kanal-paneli
   ```
3. Çıkan `URL` değerini `TURSO_DATABASE_URL`, token değerini `TURSO_AUTH_TOKEN` olarak Vercel proje ayarlarındaki **Environment Variables** kısmına ekleyin (`YOUTUBE_API_KEY` ile birlikte).

## Vercel'e Deploy

Proje GitHub'a bağlı ve Vercel'de otomatik deploy etkin: `main` branch'ine yapılan her `git push`, production'a otomatik olarak deploy edilir. Ayrıca `vercel --prod` komutuna gerek yoktur.

Sıfırdan kurulum yapılacaksa:

1. Bu projeyi bir GitHub deposuna push'layın.
2. [vercel.com](https://vercel.com) üzerinden "Add New Project" ile depoyu içe aktarın (Next.js otomatik algılanır).
3. **Environment Variables** kısmına şunları ekleyin:
   - `YOUTUBE_API_KEY`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `CRON_SECRET` — rastgele bir değer (örn. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`); `/api/cron/refresh-channels` uç noktasını yetkisiz çağrılardan korur, Vercel Cron bunu otomatik `Authorization: Bearer` başlığı olarak gönderir.
4. Deploy edin. `vercel.json` içindeki `crons` tanımı, günlük otomatik yenilemeyi otomatik olarak devreye alır.

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — production build
- `npm run start` — production sunucusu
- `npm run lint` — ESLint
