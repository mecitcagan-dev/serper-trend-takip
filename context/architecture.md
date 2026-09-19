# Architecture Context

## Stack

| Katman                | Teknoloji                                           | Rol                                           |
| --------------------- | --------------------------------------------------- | --------------------------------------------- |
| Frontend              | Vanilla JavaScript (ES modules), framework yok      | UI render, kullanıcı etkileşimi               |
| Styling               | Plain CSS + CSS custom properties (tema token'ları) | Görsel tasarım, tema                          |
| Auth                  | Supabase Auth (email/şifre + Google OAuth)          | Kullanıcı kimlik doğrulama, oturum yönetimi   |
| Veritabanı            | Supabase (Postgres) + Row Level Security            | Veri saklama + kullanıcı izolasyonu           |
| Otomasyon             | Python 3 (`scan.py`, `requests`, `supabase-py`)     | Periyodik tarama, karşılaştırma, veri yazımı  |
| Zamanlayıcı           | GitHub Actions (cron) + opsiyonel dış cron           | `scan.py`'yi periyodik tetikleme              |
| Hosting (frontend)    | Vercel (statik site)                                | `docs/` klasörünü servis etme                 |
| Build                 | Node.js script (`generate-config.js`)               | `.env` / Vercel env var → `config.js` üretimi |
| 3. parti veri kaynağı | serper.dev API                                      | Google TR arama sonuçları                     |

## Klasör Yapısı

> Bu ağaç, dosyalar bir "knowledge base" / "project" özelliğine düz
> (flat, klasörsüz) olarak yüklendiğinde bile gerçek konumların
> netleşmesi için buraya bilerek eklendi. Bir dosya ismi hangi klasörde
> geçiyorsa, o path'i burada ara.

```
serper-trend-takip/
├── .gitignore
├── .env.example
├── .env                        ← repoya girmez, sadece yerelde
├── README.md
├── plan.md
├── requirements.txt
├── schema.sql
├── serper_client.py
├── compare_engine.py
├── scan.py
├── CLAUDE.md
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── ui-context.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   └── progress-tracker.md
├── .github/
│   └── workflows/
│       └── scan.yml
└── docs/                       ← Vercel Root Directory BURASI
    ├── package.json
    ├── vercel.json               ← sadece buildCommand; outputDirectory
    │                               belirtilmiyor, Vercel'in "public"
    │                               varsayılanı doğrudan eşleşiyor
    ├── scripts/
    │   └── generate-config.js    ← config.js'i public/ altına üretir
    └── public/                   ← Vercel Output Directory (varsayılan "public")
        ├── index.html
        ├── style.css
        ├── config.js              ← build sırasında OTOMATİK üretilir, repoya girmez
        └── js/
            ├── main.js               ← tek giriş noktası
            ├── state.js              ← paylaşılan uygulama durumu
            ├── supabaseClient.js     ← sb client
            ├── auth.js               ← giriş/kayıt/oturum
            ├── feed.js                ← Activity akışı + detay paneli
            ├── keywordsModal.js      ← kelime ekleme/silme
            ├── apiKeyModal.js        ← Serper API key yönetimi
            ├── intervalControl.js   ← tarama sıklığı yönetimi
            ├── serperKey.js          ← ücretsiz kota banner'ı
            ├── projects.js           ← müşteri/proje bağlamı
            ├── dashboard.js          ← proje özeti ve kota
            ├── reports.js            ← CSV + yazdırılabilir rapor
            ├── audit.js              ← işlem audit kayıtları
            ├── profileMenu.js        ← avatar/dropdown, tema, çıkış
            ├── theme.js              ← açık/koyu tema
            └── utils.js              ← escapeHtml, tarih/saat formatlama
```

**Önemli:** Aynı isimli dosyalar farklı klasörlerde olabilir (şu an
yok ama ileride olabilir) — bir AI dosya sistemine erişemiyorsa (ör.
Claude Project'e her şey düz yüklendiyse), hangi dosyanın hangi path'e
ait olduğunu HER ZAMAN bu ağaçtan doğrulamalı, dosya adına bakıp
tahmin etmemeli.

## Sistem Sınırları

- `docs/` — Statik frontend. Sadece Supabase'e (anon key + RLS
  üzerinden) ve tarayıcı API'lerine (localStorage tema) konuşur. Hiçbir
  zaman service_role key veya serper.dev key'i (paylaşımlı olan) içermez.
- `docs/public/js/state.js` — Modüller arası paylaşılan TEK mutable state
  objesi. Başka hiçbir global state mekanizması kullanılmaz.
- `docs/public/js/supabaseClient.js` — Supabase client'ın tek oluşturulduğu
  yer; diğer modüller `sb`'yi buradan import eder.
- Kök dizindeki Python dosyaları (`scan.py`, `serper_client.py`,
  `compare_engine.py`) — Tarama, karşılaştırma ve iş mantığının tamamı
  burada. service_role key ile çalışır, RLS'i bypass eder, bu yüzden
  her sorguda `user_id` filtresini KENDİSİ elle uygular.
- `schema.sql` — Veritabanı şemasının ve RLS policy'lerinin TEK
  doğruluk kaynağı (source of truth). Şema değişikliği önce burada
  yapılır, sonra Supabase Dashboard'da çalıştırılır.
- `.github/workflows/scan.yml` — GitHub cron/manual tetikleyici tanımı,
  GitHub Secrets'ı `scan.py`'ye ortam değişkeni olarak geçirir. GitHub'ın
  best-effort schedule davranışı yetersiz kalırsa aynı workflow
  `workflow_dispatch` API'si üzerinden ücretsiz bir dış cron servisiyle
  tetiklenebilir.
- `context/*.md` + `CLAUDE.md` — Proje bağlamı; kod değil, sadece
  yapay zeka asistanları ve geliştiriciler için dokümantasyon.

## Storage Modeli

- **Veritabanı (Supabase/Postgres)**: Tüm kalıcı veri burada —
  `profiles`, `projects`, `keywords`, `runs`, `keyword_snapshots`, `settings`,
  `audit_logs`, `scan_leases`
  (bkz. `schema.sql`). Blob/dosya depolama YOK, her şey ilişkisel
  tablo + jsonb kolonlarda (`runs.details`,
  `keyword_snapshots.organic` vb.).
- **Tarayıcı localStorage**: Sadece tema tercihi (`stt-theme`) ve Google OAuth
  Client ID tutulabilir. Access token kalıcı olarak saklanmaz.
- **Ortam değişkenleri / secrets**: `.env` (yerel, gitignore'da)
  sadece public anon key'leri içerir; GitHub Secrets gizli
  service_role ve paylaşımlı serper key'i içerir; Vercel env vars
  build sırasında public anon key'leri `config.js`'e yazar.

## Auth ve Erişim Modeli

- Her kullanıcı Supabase Auth ile (email/şifre veya Google) giriş
  yapar, `auth.users.id` (uuid) tüm tablolarda `user_id` olarak
  referans alınır.
- Sahiplik modeli: her satır tam olarak bir kullanıcıya aittir
  (`user_id` kolonu); paylaşılan/çok kullanıcılı satır yok.
- Erişim kontrolü tamamen RLS ile: `authenticated` rolü sadece
  `user_id = auth.uid()` olan satırları görebilir/değiştirebilir; kod
  tarafında ekstra `.eq('user_id', ...)` filtresi GEREKMEZ (ama
  `scan.py` service_role kullandığı için ORADA elle filtre ŞART).
- `profiles.shared_key_scans_used` kolonu özel: bir trigger
  (`protect_shared_key_scans_used`) bu kolonun sadece `service_role`
  tarafından değiştirilmesine izin verir — kullanıcı kendi hakkını
  sıfırlayamaz.
- `profiles.role` değerleri `admin`, `team_member` ve `client_viewer` olarak
  tanımlıdır. `client_viewer`, veritabanı policy'leriyle yazma işlemlerinden
  engellenir; ücretsiz teslim sürümünde erişim modeli kullanıcı sahipliği
  üzerindedir, ekip davet UI'ı eklenmemiştir.

## Değişmezler (Invariants)

1. `SUPABASE_SERVICE_KEY` hiçbir zaman `docs/` altına, frontend koduna
   veya commit edilen herhangi bir dosyaya yazılmaz.
2. Yeni bir tablo/kolon eklendiğinde, o tabloya erişecek her sorgudan
   ÖNCE ilgili RLS policy'si `schema.sql`'e eklenir ve Supabase'de
   çalıştırılır.
3. `docs/config.js` asla elle doldurulmaz veya commit edilmez; sadece
   build script (`generate-config.js`) tarafından üretilir.
4. `shared_key_scans_used` sayacı sadece `scan.py` (service_role)
   tarafından artırılır; frontend'den bu kolona yazma girişimi
   olmamalı.
5. Frontend framework'süz vanilla JS ES modules olarak kalır; bir
   framework/bundler eklenmesi açık bir mimari kararı gerektirir (bu
   dosyanın güncellenmesi dahil).
6. Her JS modülü kendi DOM event listener'larını kendi `init()`
   fonksiyonu içinde bağlar; `main.js` sadece sırayla `init()` çağırır,
   başka mantık içermez.
7. Modüller arası döngüsel import yapılmaz; çapraz modül koordinasyonu
   gerekiyorsa fonksiyon `main.js` üzerinden callback olarak geçirilir
   (örnek: `profileMenu.init(auth.handleLogout)`).
8. `SHARED_KEY_LIMIT` sabiti `scan.py` ve `docs/js/serperKey.js` içinde
   birbirinden bağımsız tanımlıdır ve senkron tutulmalıdır (ayrı bir
   config dosyasına taşınmadıkça).
