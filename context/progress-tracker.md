# Progress Tracker

## Şu Anki Faz

Devam ediyor — çekirdek ürün (auth, kullanıcı izolasyonu, kişisel/
paylaşımlı Serper key, activity akışı) tamamlandı ve production'da
çalışıyor. Vercel deploy hatası bug fix'i bu oturumda tamamlandı.

## Şu Anki Hedef

Kullanıcının bildirdiği 5 iş üzerinden plan. Her madde için kod
DEĞİŞTİRİLMEDİ — sadece bu bölüm yazıldı, onay bekleniyor.

---

### İş 1 — İkinci kullanıcıya tarama sonucu gelmiyor

**Teşhis:** `profiles` satırı SADECE `settingsModal.js`'teki
`saveSettings()` çalıştığında (kullanıcı Ayarlar modalını açıp
Kaydet'e bastığında) `upsert` ile oluşuyor — kayıt/girişte otomatik
bir satır oluşmuyor (`schema.sql`'de böyle bir trigger yok).
`scan.py`'deki `get_all_profiles()` ise taranacak kullanıcı listesini
BAŞTAN `profiles` tablosundan çekiyor. Yani Ayarlar modalını hiç
açıp kaydetmemiş bir kullanıcının `profiles` satırı yok → `scan.py`
o kullanıcıyı hiç görmüyor, kelimeleri olsa bile atlanıyor. Muhtemel
kök neden bu.

**Plan Maddesi 1:** `schema.sql`'e, `auth.users`'a her yeni kayıtta
otomatik `profiles` satırı (id + email) açan bir trigger eklenecek,
ayrıca var olan (satırsız) kullanıcılar için tek seferlik bir
backfill INSERT'i eklenecek.

- Etkilenen dosya: `schema.sql` (**⚠️ korumalı dosya** —
  `ai-workflow-rules.md` gereği açıkça onay istiyorum)
- Dikkat: `code-standards.md` — Python/SQL tarafında `user_id`
  filtresi zaten korunuyor, bu değişmiyor. RLS policy'leri
  DEĞİŞMİYOR, sadece yeni bir trigger + `profiles.email` kolonu
  ekleniyor.
- Bu değişiklik İş 5 (email bildirimi) için de gerekli altyapıyı
  hazırlıyor (aşağıya bakınız) — iki iş aynı schema adımını paylaşıyor.
- `ai-workflow-rules.md` — "Şema değişikliği + tüketen kod" kuralı:
  ÖNCE bu migration Supabase'de çalıştırılıp doğrulanacak, SONRA
  (gerekirse) tüketen kod güncellenecek. `scan.py`'de bu iş için ekstra
  kod değişikliği GEREKMİYOR — trigger sayesinde her kullanıcının zaten
  `profiles` satırı olacağından mevcut `get_all_profiles()` mantığı
  aynen çalışacak.

---

### İş 2 — Tarama sonucu F5 atmadan otomatik görünmeli

**Teşhis:** Şu an `loadRuns()` sadece uygulama ilk açıldığında
(`state.appInitialized`) ve manuel "Yenile" butonuna basıldığında
çağrılıyor. Otomatik yenileme/canlı güncelleme mekanizması yok.

**Plan Maddesi 2a:** `schema.sql`'e `runs` tablosunu Supabase Realtime
publication'ına ekleyen satır eklenecek (`alter publication
supabase_realtime add table runs;`), Supabase'de çalıştırılıp
doğrulanacak.

- Etkilenen dosya: `schema.sql` (**⚠️ korumalı dosya**)
- Yeni bağımlılık YOK — Realtime, zaten kullanılan `@supabase/supabase-js`
  içinde geliyor (`code-standards.md`'deki "gerçekten gerekli mi"
  ilkesine uygun).

**Plan Maddesi 2b (2a doğrulandıktan SONRA):** `docs/public/js/feed.js`'e
Supabase Realtime `postgres_changes` aboneliği eklenecek — giriş yapan
kullanıcının `runs` tablosuna yeni bir satır INSERT edildiğinde feed
otomatik yenilenecek (F5/manuel yenile gerekmeden), Gmail'deki gibi.

- Etkilenen dosya: `docs/public/js/feed.js`
- Dikkat: `code-standards.md` — modül kendi `init()` içinde bağlanacak,
  `main.js`'e ekstra mantık eklenmeyecek; Supabase çağrıları için
  mevcut hata yönetimi deseni korunacak.
- `ai-workflow-rules.md` bölme kuralı gereği 2a'dan (şema) SONRA, ayrı
  bir adım olarak uygulanacak.

---

### İş 3 — UI iyileştirmeleri

**Teşhis — somut olarak tespit ettiklerim:**

- Ekran görüntüsündeki çirkin "NEW" rozeti aslında bir emoji: `feed.js`
  içindeki `EVENT_META.yeni_rakip.icon = '🆕'` (macOS bunu köşeli "NEW"
  ikonu olarak render ediyor). Bu zaten `ui-context.md`'nin ikon
  kuralına ("kütüphane yok, tüm ikonlar elle yazılmış inline SVG,
  stroke tabanlı") aykırı — emoji kullanılmamalıydı.
- Sağ üstteki profil avatarı (`profile-wrap`) CSS'te `position: fixed;
top: 14px` — bu yüzden `header-actions` içindeki diğer 3 ikon
  butonuyla (Yenile/Ayarlar/Kelime Düzenle, ki onlar normal flex akışında
  `padding: 20px 18px 8px` içinde) aynı dikey hizada durmuyor. "Bazıları
  ortalı bazıları değil" dediğin şey muhtemelen bu.

**Plan Maddesi 3a:** `EVENT_META`'daki 4 emoji ikon (🆕 📈 💬 🔍),
`ui-context.md`'nin ikon konvansiyonuna uygun elle yazılmış inline SVG
ile değiştirilecek (stroke tabanlı, `--ev-*` renk token'larını
`currentColor` üzerinden kullanan).

- Etkilenen dosyalar: `docs/public/js/feed.js` (ikon tanımları),
  `docs/public/style.css` (gerekirse `.feed-card-icon svg` boyutu)
- Dikkat: `ui-context.md` — mevcut ikon stili (ince stroke, 1.4–1.6
  stroke-width, 18–20 viewBox) korunacak; renkler asla hardcode
  edilmeyecek, `--ev-*` token'ları kullanılacak.

**Plan Maddesi 3b:** `.profile-wrap`'in `header-actions` içindeki diğer
ikon butonlarla dikey hizası düzeltilecek.

- Etkilenen dosya: `docs/public/style.css`
- Dikkat: `ui-context.md`'deki "Profil menüsü" layout deseni
  (`position: fixed` ile sağ üstte sabit) korunacak, sadece hizalama
  değeri düzeltilecek — layout deseninin kendisi değişmiyor.

**Açık Soru (aşağıda detaylı):** "Tamamen detaylı UI fix" ifadesi
3a/3b'nin ötesinde çok geniş — bkz. Açık Sorular.

---

### İş 4 — Karşılaştırma algoritması nasıl çalışıyor / boş sekmeler

Bu iş bir kod değişikliği değil, bir açıklama isteği — cevabı sohbette
ayrıca verildi (bkz. bu oturumun ana yanıtı). Plan maddesi YOK. "Ne
girilirse girilsin güzel sonuç versin" kısmı belirsiz — bkz. Açık
Sorular.

---

### İş 5 — Otomasyon tamamlanınca email bildirimi

`plan.md`'deki "Sırada" madde 5-6 ile örtüşüyor ama tetikleme koşulu
ve opt-in akışı netleşmeden kod yazılamaz — bkz. Açık Sorular. İş 1'de
eklenecek `profiles.email` kolonu, karar verildiğinde bu iş için de
altyapı sağlayacak (`scan.py`'nin service_role ile `auth.users`
şemasına doğrudan postgrest erişimi yok, bu yüzden email'in
`profiles`'ta denormalize tutulması gerekiyor).

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
- `context/` dokümantasyon sistemi
- **Vercel deploy fix (bu oturum):** "No Output Directory named 'public'
  found" hatası — kök neden, `docs/vercel.json`'da `outputDirectory`
  tanımsızken statik dosyaların `docs/` kökünde (bir `public/` alt
  klasörü olmadan) durmasıydı. Çözüm: `docs/index.html`, `style.css`,
  `js/` → `docs/public/` altına taşındı; `generate-config.js` artık
  `config.js`'i `docs/public/config.js` olarak üretiyor; `.gitignore`
  buna göre güncellendi. `vercel.json` değişmedi (Vercel'in varsayılan
  `public` output arayışı artık gerçek konumla örtüşüyor).

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

**İş 3 — UI:**

- "Tamamen detaylı bir UI fix" / "çok daha iyi bir hal alacak" çok
  geniş kapsamlı bir istek. Somut olarak tespit edebildiğim iki şeyi
  (3a: emoji ikonlar, 3b: profil avatarı hizası) plana ekledim. Bunun
  ötesinde hangi ekran/eleman rahatsız edici? Elimde bir mockup/referans
  yoksa geri kalanını tahmin edip büyük bir "yeniden tasarım" işine
  girmek `ai-workflow-rules.md`'nin "büyük spekülatif değişikliklerden
  kaçınılır" ilkesine aykırı olur. Somut örnekler (ekran görüntüsü +
  ne rahatsız ediyor) verirsen onları da küçük doğrulanabilir adımlar
  olarak plana eklerim.

**İş 4 — Algoritma:**

- "Ne girersek girelim yine aynı şekilde güzel bir sonuç versin"
  ifadesi belirsiz — algoritmanın davranışında somut olarak ne
  değişmesini istiyorsun? (Mevcut davranış: ilk taramada hiçbir zaman
  "değişiklik" çıkmaz çünkü karşılaştırılacak önceki veri yok — bu
  beklenen davranış, bug değil. "Sıralama"/"Yeni Trend" sekmelerinin
  boş görünmesi de muhtemelen `determine_event_type()`'ın tüm run için
  TEK bir event_type seçmesinden kaynaklanıyor — aynı run içinde hem
  yeni rakip hem sıralama değişimi varsa run'a sadece "yeni_rakip"
  etiketi veriliyor, "Sıralama" sekmesi o run'ı hiç göstermiyor. Bunu
  değiştirmek [per-keyword event tipi gibi] veri modelinde büyük bir
  değişiklik gerektirir — açıkça istemedikçe yapmıyorum.)

**İş 5 — Email bildirimi:**

- Email hangi adrese gidecek: sadece Supabase Auth login email'i mi
  (otomatik, "Connect to Mail" butonuna gerek kalmaz), yoksa
  `plan.md`'deki orijinal "Connect to Mail" opt-in butonu tasarımı
  hâlâ isteniyor mu?
- Her scan TAMAMLANDIĞINDA mı (event_type ne olursa olsun) yoksa
  sadece anlamlı bir DEĞİŞİKLİK tespit edildiğinde mi (`event_type !=
'degisiklik_yok'`, `plan.md`'nin orijinal tasarımı) mail atılsın?
  Mesajın "otomasyonunuz tamamlandı" örneği ilkine işaret ediyor ama
  bu, kullanıcı hiçbir değişiklik olmasa bile her 6 saatte bir (veya
  seçtiği sıklıkta) mail alacağı anlamına gelir — istediğin bu mu?
- Resend hesabın/API key'in hazır mı? Onaylanırsa GitHub Secrets'a
  `RESEND_API_KEY` eklemen gerekecek (ben kodu yazarım, secret'ı
  eklemek sana kalıyor).
- Email bildirimi `scan.py` içine mi eklenecek yoksa ayrı bir
  `notify.py` script'ine mi taşınacak? (Henüz karar verilmedi.)

## Mimari Kararlar

- **RLS ile izolasyon**: Uygulama kodu tarafında manuel `user_id`
  filtresi yerine Supabase RLS tercih edildi — çünkü frontend
  kodunda unutulma riski yüksek, RLS veritabanı seviyesinde garanti
  veriyor. (Sadece `scan.py` service_role kullandığı için istisna —
  orada elle filtrelemek ZORUNLU.)
- **Server-side kota uygulaması**: Paylaşımlı Serper key kotası sadece
  `scan.py`'de (service_role ile) sayılıyor, frontend sadece
  gösteriyor — kullanıcı tarayıcıdan kotasını manipüle edemesin diye.
- **Build-time config üretimi**: `docs/public/config.js` commit edilmiyor,
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
  - `context/` altı dosyalık sistem kuruldu ve mevcut kod tabanından
    gerçek bilgilerle dolduruldu.
- Kullanıcı ayrıca mevcut dosya/klasör yapısının iyi olup olmadığını
  sordu — değerlendirme: yapı zaten net (frontend `docs/`, otomasyon
  kökte, şema `schema.sql`'de) ve tam bir "rework" GEREKMİYOR; tek
  eklenen şey bu `context/` klasörü ve kök dizindeki `CLAUDE.md`.
- Bir sonraki oturuma başlarken: önce `CLAUDE.md`'yi, sonra sırasıyla
  `context/project-overview.md` → `architecture.md` → `ui-context.md`
  → `code-standards.md` → `ai-workflow-rules.md` →
  `progress-tracker.md`'yi oku.
