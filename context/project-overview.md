# Serper Trend Takip

## Genel Bakış

Kullanıcıların takip etmek istedikleri anahtar kelimelerin Google (TR)
arama sonuçlarını düzenli aralıklarla tarayan, bir önceki taramayla
karşılaştırıp değişiklikleri (yeni rakip domain, sıralama değişimi, yeni
"İnsanlar Ayrıca Sordu" soruları, yeni ilgili aramalar) tespit eden,
sunucu gerektirmeyen, çok kullanıcılı bir SEO/rakip takip aracı. Ajans
kullanmadan kendi SEO'sunu takip etmek isteyen bireysel kullanıcılar ve
küçük ekipler için tasarlandı. Tamamen ücretsiz katmanlarla (GitHub
Actions + Supabase free tier + Vercel free tier + serper.dev free quota)
çalışacak şekilde kurgulandı.

## Hedefler

1. Kullanıcının girdiği anahtar kelimeleri periyodik olarak (varsayılan
   6 saat, kullanıcı ayarlayabilir) otomatik taramak
2. Taramalar arası anlamlı değişiklikleri (yeni rakip, sıralama kayması,
   yeni PAA/ilgili arama) otomatik tespit edip özetlemek
3. Bu değişiklikleri Slack tarzı bir "Activity" akışında kullanıcıya
   sunmak, karta tıklayınca detaylı rapor göstermek
4. Kullanıcı verisini tam izole tutmak (RLS) ve her kullanıcının kendi
   Serper API key'ini veya sınırlı ortak deneme key'ini kullanmasına
   izin vermek

## Ana Kullanıcı Akışı

1. Kullanıcı email/şifre veya Google ile kayıt olur / giriş yapar
   (Supabase Auth)
2. (Email/şifreyle kayıtta) email doğrulama linkine tıklar, otomatik
   olarak uygulamaya alınır
3. Ayarlar modalından kendi Serper API key'ini girer YA DA girmeden
   kişi başı 10 taramalık ortak deneme key'ini kullanmaya devam eder
4. "Kelimeleri Düzenle" modalından takip etmek istediği anahtar
   kelimeleri tekli/toplu ekler, aktif/pasif işaretler
5. GitHub Actions cron'u (5 dakikada bir kontrol eder, ancak GitHub bunu
   best-effort çalıştırır) arka planda tarama yapar; gerçek tarama, kullanıcının
   seçtiği sıklık geçmemişse `scan.py` tarafından atlanır. Gerekirse aynı
   workflow ücretsiz bir dış cron servisiyle tetiklenebilir.
6. Yeni bir çalıştırma (run) olduğunda kullanıcı Activity akışını
   yenileyip (veya sayfayı açtığında) kartları görür, karta tıklayıp
   detaylı raporu okur

## Özellikler

### Kimlik Doğrulama ve Kullanıcı Yönetimi

- Email/şifre kayıt + giriş, şifre min. 8 karakter, şifre gücü göstergesi
- Google OAuth ile giriş
- Email doğrulama akışı (bekleme ekranı, otomatik geçiş, tekrar gönder)
- Türkçeleştirilmiş hata mesajları (Supabase Auth hata metinlerinin
  çevirisi)

### Anahtar Kelime Yönetimi

- Tekli/toplu kelime ekleme (satır veya virgülle ayrılmış)
- Aktif/pasif işaretleme, silme
- Kaydet ile toplu insert/update/delete (yalnızca değişenler işlenir)

### Activity Akışı

- Gün bazlı gruplanmış, olay tipine göre filtrelenebilir
  (Tümü / Sıralama / Yeni Rakip / Yeni Trend) kart listesi
- Karta tıklayınca sağ panelde kelime bazlı detaylı rapor (yeni/çıkan
  domainler, sıralama değişim listesi, yeni PAA soruları, yeni ilgili
  aramalar)

### Ayarlar

- Kişisel Serper API key girme/güncelleme
- Ortak/paylaşımlı deneme key kotası göstergesi (kalan hak)
- Tarama sıklığı seçimi (test amaçlı düşük değerlerden 24 saate kadar)

### Tema

- Açık/koyu tema, localStorage'da kalıcı, varsayılan koyu

## Kapsam

### Kapsam İçinde

- Yukarıdaki tüm özellikler (mevcut, çalışır durumda)
- Kod/dosya organizasyonu ve context dokümantasyonu (bu oturumun hedefi
  — bkz. progress-tracker.md)

### Kapsam Dışında (şimdilik)

- "Connect to Mail" butonu ve email bildirim sistemi (plan.md madde
  5-6, henüz başlanmadı)
- Herhangi bir framework/bundler geçişi (React, Vite vb.) — açıkça
  istenmedikçe yapılmayacak
- Yeni ürün özelliği eklenmesi — bu oturumda hedef sadece mevcut
  yapının düzenlenmesi, yeni davranış eklenmeyecek

## Başarı Kriterleri

1. Yeni bir yapay zeka asistanı, sadece `CLAUDE.md` + `context/*.md`
   dosyalarını okuyarak projenin ne olduğunu, mimarisini ve şu anki
   durumunu tam olarak anlayabilmeli
2. Var olan davranışta hiçbir regresyon olmadan dosya/klasör
   organizasyonu netleşmiş olmalı
3. `progress-tracker.md` her oturum sonunda güncel tutulabilecek
   şekilde hazır olmalı
