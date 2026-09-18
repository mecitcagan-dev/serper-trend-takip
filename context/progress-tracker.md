# Progress Tracker

## Şu Anki Faz

Devam ediyor — çekirdek ürün (auth, kullanıcı izolasyonu, kişisel/
paylaşımlı Serper key, activity akışı) tamamlandı ve production'da
çalışıyor. Şu an odak: **kod eklemeden proje dokümantasyonunu/context
sistemini kurmak** (bu oturum).

## Şu Anki Hedef

Farklı yapay zeka asistanları arasında geçiş yaparken bağlam kaybını
önlemek için `CLAUDE.md` + `context/*.md` altı dosyalık sistemi,
gerçek proje durumunu yansıtacak şekilde doldurmak. Bu oturumda kodda
HİÇBİR değişiklik yapılmadı.

## Tamamlanan

- Dil tutarlılığı: tüm görünür arayüz metinleri Türkçe
- Supabase Auth: email/şifre + Google OAuth, email doğrulama akışı,
  Türkçe hata mesajları
- Kullanıcı bazlı veri izolasyonu: `keywords`/`runs`/
  `keyword_snapshots`/`settings` tablolarına `user_id` + RLS
  policy'leri
- `scan.py`'nin çok kullanıcılı hale getirilmesi (her kullanıcı kendi
  kelime listesi + kendi tarama sıklığı ile taranıyor)
- Kişiye özel Serper API key + ortak/paylaşımlı deneme key (kişi başı
  10 tarama, server-side sayaç + trigger korumalı)
- `context/` dokümantasyon sistemi (bu oturum)

## Devam Eden

- Yok.

## Sırada

1. "Connect to Mail" butonu (sağ altta, Gmail temalı, tek tıkla
   kullanıcının login email'ini "connect" olarak işaretleme)
2. Email bildirim sistemi: yeni aktivite (`event_type !=
   'degisiklik_yok'`) tespit edildiğinde, mail'i connect etmiş
   kullanıcıya Resend ile otomatik mail
   - Gerekli: `profiles` tablosuna mail-connect durumu için kolon,
     Resend API key GitHub Secrets'a eklenmeli, muhtemelen `scan.py`
     içine (veya ayrı bir script'e) bildirim gönderme adımı

## Açık Sorular

- Email bildirimleri `scan.py` içine mi eklenecek yoksa ayrı bir
  `notify.py` script'ine mi taşınacak? (Henüz karar verilmedi.)
- "Connect to Mail" sadece giriş email'ini mi kullanacak, yoksa
  kullanıcı farklı bir bildirim adresi girebilecek mi? (`plan.md`'de
  netleştirilmemiş.)

## Mimari Kararlar

- **RLS ile izolasyon**: Uygulama kodu tarafında manuel `user_id`
  filtresi yerine Supabase RLS tercih edildi — çünkü frontend
  kodunda unutulma riski yüksek, RLS veritabanı seviyesinde garanti
  veriyor. (Sadece `scan.py` service_role kullandığı için istisna —
  orada elle filtrelemek ZORUNLU.)
- **Server-side kota uygulaması**: Paylaşımlı Serper key kotası sadece
  `scan.py`'de (service_role ile) sayılıyor, frontend sadece
  gösteriyor — kullanıcı tarayıcıdan kotasını manipüle edemesin diye.
- **Build-time config üretimi**: `docs/config.js` commit edilmiyor,
  her build'de `.env`/Vercel env vars'tan üretiliyor — secret
  sızıntısı riskini azaltmak ve tek bir doğruluk kaynağı (Vercel env
  vars) olmasını sağlamak için.
- **Framework'süz frontend**: Proje ölçeği küçük olduğu için
  React/Vue gibi bir framework bilinçli olarak tercih edilmedi;
  vanilla JS ES modules + tek paylaşılan state objesi yeterli
  görüldü.

## Oturum Notları

- Bu oturumda: kullanıcı farklı yapay zeka asistanları arasında geçiş
  yaparken bağlam kaybı yaşadığını belirtti, çözüm olarak `CLAUDE.md`
  + `context/` altı dosyalık sistem kuruldu ve mevcut kod tabanından
  gerçek bilgilerle dolduruldu.
- Kullanıcı ayrıca mevcut dosya/klasör yapısının iyi olup olmadığını
  sordu — değerlendirme: yapı zaten net (frontend `docs/`, otomasyon
  kökte, şema `schema.sql`'de) ve tam bir "rework" GEREKMİYOR; tek
  eklenen şey bu `context/` klasörü ve kök dizindeki `CLAUDE.md`.
- Bir sonraki oturuma başlarken: önce `CLAUDE.md`'yi, sonra sırasıyla
  `context/project-overview.md` → `architecture.md` → `ui-context.md`
  → `code-standards.md` → `ai-workflow-rules.md` →
  `progress-tracker.md`'yi oku.
