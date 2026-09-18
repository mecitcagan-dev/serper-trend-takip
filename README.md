# Serper Trend Takip

Belirlediğin anahtar kelimelerin Google TR sonuçlarını seçtiğin sıklıkta
serper.dev üzerinden tarayan, değişiklikleri (yeni rakip, sıralama değişimi,
yeni "insanlar ayrıca sordu" soruları, yeni ilgili aramalar) Slack Activity
tarzı bir akışta gösteren, tamamen ücretsiz ve sunucu gerektirmeyen otomasyon.

**Mimari:** GitHub Actions (cron + Python) → Supabase (veritabanı) → GitHub
Pages (arayüz). GitHub cron gecikirse aynı workflow, ücretsiz bir dış cron
servisiyle `workflow_dispatch` üzerinden tetiklenebilir.

---

## Kurulum

### 1. Supabase tabloları

1. Supabase projenin **SQL Editor**'üne gir.
2. Bu repodaki `schema.sql` dosyasının tam içeriğini yapıştır, **Run**'a bas.
   (Tablolar + güvenlik kuralları + 3 örnek kelime otomatik oluşur.)

### 2. Supabase anahtarlarını al

Supabase Dashboard → **Settings → API**:

- **Project URL**
- **anon / public key**
- **service_role key** (⚠️ bunu asla frontend'e veya herkese açık bir yere koyma)

### 3. Bu repoyu GitHub'a yükle

```bash
cd serper-trend-takip
git init
git add .
git commit -m "İlk kurulum"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/serper-trend-takip.git
git push -u origin main
```

Repo'yu **private** oluşturman önerilir (API key'lerin secrets içinde kalsa da,
kodun ve iş mantığının herkese açık olmaması daha güvenli).

### 4. GitHub Secrets ekle

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| İsim                   | Değer                     |
| ---------------------- | ------------------------- |
| `SUPABASE_URL`         | Supabase Project URL      |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key |
| `SERPER_API_KEY`       | serper.dev API anahtarın  |
| `SHARED_SERPER_API_KEY`| Alternatif ortak Serper key'i (opsiyonel) |

### 5. Otomasyonu test et

Repo → **Actions** sekmesi → "Serper Trend Taramasi" workflow'unu seç →
**Run workflow** ile manuel tetikle. Yeşil ✓ görünce Supabase'de `runs`
tablosunda yeni bir satır oluşmuş olmalı.

Workflow logunda önce secret kontrolü, sonra profil ve kelime sayısı
görünür. `runs` tablosuna kayıt yazılmıyorsa logdaki ilk `HATA` satırını
kontrol et; özellikle `schema.sql` içindeki `service_role` GRANT'larının
Supabase SQL Editor'de çalıştırılmış olması gerekir.

### 6. GitHub cron gecikirse ücretsiz dış tetikleyici

GitHub Actions `schedule` olayları garanti zamanlayıcı değildir. 5 dakikalık
kontrol ihtiyacı için [cron-job.org](https://cron-job.org/) üzerinde 5 dakikalık
bir job oluşturup aşağıdaki isteği gönder:

- URL: `https://api.github.com/repos/KULLANICI/REPO/actions/workflows/scan.yml/dispatches`
- Method: `POST`
- Headers: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`,
  `Content-Type: application/json`, `Authorization: Bearer GITHUB_TOKEN`
- Body: `{"ref":"main"}`

Token, yalnızca bu repo için workflow çalıştırma yetkisi olan fine-grained bir
GitHub token'ı olmalı. Supabase ve Serper secret'larını cron-job.org'a
ekleme; onlar GitHub Secrets'ta kalır. Aynı anda hem GitHub schedule hem dış
cron açık bırakılırsa workflow'daki concurrency ayarı çakışan çalıştırmaları
bekletir.

### 7. Auth ayarı (opsiyonel)

Supabase Dashboard → **Authentication → Providers → Email**: varsayılan olarak
kayıt sonrası email onayı istenir. Test sırasında hızlı ilerlemek istersen
**"Confirm email"** seçeneğini kapatabilirsin — o zaman kayıt olan kullanıcı
anında giriş yapılmış olur. Prod'da açık bırakman önerilir.

`schema.sql`'i tekrar çalıştırman, eski `anon_*` RLS kurallarını kaldırıp
yerine `authenticated_*` kurallarını koyar (artık siteye sadece giriş yapmış
kullanıcılar erişebilir).

### 8. Frontend'i doldur ve yayınla

1. `site/config.js` içindeki iki değeri doldur:
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...'; // sadece anon/public key
   ```
2. Değişikliği GitHub'a push'la.
3. Repo → **Settings → Pages** → Source: "Deploy from a branch" → Branch:
   `main`, klasör: `/site` → **Save**.
4. Birkaç dakika sonra GitHub sana bir link verecek
   (`https://KULLANICI_ADIN.github.io/serper-trend-takip/`) — arayüz burada.

---

## Kullanım

- Ana ekranda **Activity** akışını görürsün — her başarılı tarama burada bir
  kart olarak belirir.
- Bir karta tıkla → sağda o çalıştırmanın tam raporu açılır.
- Sağ alttaki **"Kelimeleri Düzenle"** butonuyla kelime ekle/sil/aktif-pasif
  yap, **Kaydet**'e bas. Bir sonraki tarama güncel listeyi kullanır.

## Bilinmesi gerekenler

- GitHub Actions'ın cron tetikleyicisi _best-effort_'tur — gecikebilir veya
  yoğunlukta bir çalıştırmayı düşürebilir. Düzenli 5 dakikalık tetikleme
  gerekiyorsa yukarıdaki cron-job.org fallback'ini kullan.
- Frontend, herkese açık bir link olduğu için (şifre korumasız) sadece linki
  bilenler erişebilir. İstersen ileride basit bir parola ekranı eklenebilir.
- Ücretsiz kotalar: GitHub Actions private repo'da ayda 2.000 dk (biz ayda
  ~120 dk kullanırız), Supabase 500MB (biz yıllarca yetecek kadar az veri
  üretiriz), serper.dev ilk 2.500 sorgu ücretsiz.
