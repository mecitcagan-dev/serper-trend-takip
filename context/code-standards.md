# Code Standards

## Genel

- Modüller küçük ve tek sorumluluklu tutulur — her `docs/public/js/*.js`
  dosyası tek bir UI alanını (feed, auth, settings vb.) yönetir.
- Kök nedeni düzelt, üstüne geçici çözüm (workaround) katman katman
  eklenmez.
- Bir dosyada ilgisiz konular karıştırılmaz (örn. auth mantığı ile feed
  render mantığı ayrı dosyalarda kalır).
- Yeni bağımlılık (npm paketi, CDN script) eklemeden önce gerçekten
  gerekli mi diye sorulur — proje bilinçli olarak minimal bağımlılıkla
  tutuluyor (tek dış bağımlılık: `@supabase/supabase-js` CDN
  üzerinden).

## JavaScript (Frontend)

- Vanilla JS, ES modules (`type="module"`), TypeScript veya bundler
  YOK.
- Her modül DOM olaylarını sadece kendi `init()` fonksiyonu içinde
  bağlar; `main.js` sırayla `initTheme()` ve her modülün `init()`'ini
  çağırır, başka mantık içermez.
- Modüller arası paylaşılan durum sadece `state.js`'teki tek `state`
  objesi üzerinden okunur/yazılır — ayrı bir state/store kütüphanesi
  kullanılmaz.
- Modüller arası döngüsel import yapılmaz; çapraz koordinasyon
  gerekiyorsa fonksiyon parametre/callback olarak `main.js` üzerinden
  geçirilir (örnek: `profileMenu.init(auth.handleLogout)`).
- Kullanıcıdan gelen veya Supabase'den okunan her metin, `innerHTML`
  ile DOM'a yazılmadan önce `utils.js`'teki `escapeHtml()` ile
  kaçışlanır (XSS önleme) — bu kural istisnasız.
- Supabase çağrıları her zaman `{ data, error }` destructure edilir,
  `error` dalı Türkçe kullanıcı mesajı + `console.error(error)` ile
  ele alınır.
- Sunucu tarafı filtreleme frontend'de yapılmaz — RLS'e güvenilir
  (`// RLS sayesinde sadece kullanıcının verisi gelir` yorum deseni
  kod genelinde tutarlı kullanılıyor, korunmalı).
- Renk asla hardcode edilmez; her zaman `style.css`'teki `:root`
  custom property'leri kullanılır.

## Yorumlar ve İsimlendirme

- Kod içi yorumlar Türkçe, fonksiyon/değişken/dosya isimleri
  İngilizce (mevcut karışık üslup — yeni kod da bu deseni takip eder).
- Kullanıcıya gösterilen tüm metinler (UI string'leri, hata mesajları)
  Türkçe.

## Python (Otomasyon)

- `snake_case` isimlendirme, her dosyanın başında kısa Türkçe
  docstring.
- Tip belirtimi (type hints) mantıklı olan her yerde kullanılır
  (`dict | None`, `list[dict]` vb.).
- `scan.py` service_role key kullandığından RLS bypass edilir — bu
  yüzden HER sorguda `user_id` filtresi elle eklenir, asla atlanmaz.
- Hata durumları kullanıcı/kelime bazında yakalanır (`try/except`) ki
  bir kelimedeki hata diğer kelimelerin taranmasını engellemesin.

## Veri ve Storage

- Kalıcı veri sadece Supabase Postgres tablolarında tutulur;
  dosya/blob storage kullanılmaz.
- `runs.details`, `keyword_snapshots.organic/people_also_ask/
  related_searches` gibi yarı yapılandırılmış veri `jsonb` kolonlarda
  tutulur — yeni bir "detay" alanı gerekirse önce bu jsonb şemasının
  nasıl büyüyeceği düşünülür, gereksiz yeni tablo açılmaz.
- Gizli değerler (`SUPABASE_SERVICE_KEY`, paylaşımlı serper key)
  hiçbir zaman veritabanına, loglara veya frontend koduna yazılmaz.

## Dosya Organizasyonu

- `docs/` — Vercel Root Directory; `package.json` ve `scripts/` burada,
  servis edilen statik dosyalar `public/` altında.
- `docs/public/` — statik frontend (HTML/CSS/JS), Vercel'in Output
  Directory olarak servis ettiği klasör.
- `docs/public/js/` — tüm ES module dosyaları (`main.js` giriş noktası,
  geri kalanı özellik bazlı modüller).
- `docs/scripts/` — build zamanı çalışan Node script'leri
  (`generate-config.js`), `docs/public/config.js`'i üretir.
- Kök dizin — Python otomasyonu (`scan.py`, `serper_client.py`,
  `compare_engine.py`), şema (`schema.sql`), proje dokümantasyonu
  (`README.md`, `plan.md`) ve `context/` klasörü.
- `.github/workflows/` — GitHub Actions tanımları.
