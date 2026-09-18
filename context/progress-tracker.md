# Progress Tracker

## Şu Anki Faz

Devam ediyor — çekirdek ürün (auth, kullanıcı izolasyonu, kişisel/
paylaşımlı Serper key, activity akışı, otomatik profil oluşturma,
Realtime canlı güncelleme) tamamlandı ve production'da çalışıyor.

Önceki oturumda araştırmaya dayalı bir özellik/hata-düzeltme yol
haritası PLANLANDI (bkz. "Şu Anki Hedef"). Kullanıcı Açık Sorular'ı
cevapladı ve önceliklendirmeyi ("sen belirle") AI'ye bıraktı; İş 8
(email bildirimi) tamamen iptal edildi (ücretsiz bir yolu olmadığı
anlaşıldı — bkz. Açık Soru 7).

Bu oturumdan itibaren "İki Aşamalı Çalışma" kuralına göre tek-madde
ilerleme moduna geçildi: her turda tek bir onaylı plan maddesi
uygulanıyor. Belirlenen öncelik sırası: **İş 4a (bu oturumda
tamamlandı) → İş 3 → İş 6 → İş 7 → (opsiyonel/şartlı) İş 5.**

## Şu Anki Hedef

> Bu bölümdeki HİÇBİR madde için kod değiştirilmedi, sadece bu dosya
> yazıldı. `ai-workflow-rules.md`'deki "İki Aşamalı Çalışma" kuralına
> göre onay bekleniyor.

Önceki oturumun hedefi olan İş 1 ve İş 2, kod tabanında (schema.sql
v4/v5, auth.js, feed.js) tamamlanmış bulundu ve bu oturumda
"Tamamlanan"a taşındı (bkz. Oturum Notları — bu bir dokümantasyon
senkron hatasıydı, düzeltildi).

Aşağıdaki maddeler öncelik sırasına göre listelendi. Her biri
`ai-workflow-rules.md`'nin kapsam kuralına uygun olarak bağımsız,
uçtan uca doğrulanabilir bir birim olacak şekilde küçük tutuldu; şema
değişikliği gerektiren maddeler, tüketen koddan ayrı adımlara
bölündü.

---

### İş 3 — 🐞 Hata: Ayarlanan tarama sıklığına (test: 10 dk) rağmen activity gelmiyor

**Teşhis:** Kod tarafında `scan.py`'nin mantığı doğru görünüyor
(`get_user_last_run_time` + `interval_minutes` karşılaştırması,
`scan_for_user` içinde). Ama üç ayrı yerde birbiriyle ÇELİŞEN bir
tarama sıklığı iddiası var:

- `context/architecture.md`: "GitHub Actions cron'u her **10
  dakikada** bir tetiklenir" diyor.
- `.github/workflows/scan.yml`'deki yorum: "Her **6 saatte** bir"
  diyor.
- `.github/workflows/scan.yml`'deki gerçek `cron` değeri: `*/5 * * * *`
  → yani fiilen her **5 dakikada** bir.

Bu üçü aynı anda doğru olamaz — bu tek başına bir dokümantasyon/kod
tutarsızlığı ve düzeltilmeli.

Bunun ötesinde, "10 dakika ayarladım ama hiçbir şey gelmedi" şikâyeti
için en olası açıklama GitHub Actions'ın `schedule` tetikleyicisinin
doğası: GitHub bunu resmi olarak **"best effort", garanti değil**
olarak tanımlıyor — yoğun saatlerde (özellikle her saatin başında)
5-30 dakika hatta daha uzun gecikmeler yaygın olarak bildiriliyor,
minimum desteklenen aralık 5 dakika, ve **yeni/az aktiviteli repolar
kuyruğa en düşük öncelikle giriyor** (bazı vakalarda saatlerce
gecikme). Ayrıca 60 gün commit'siz kalan repolarda scheduled
workflow'lar sessizce devre dışı kalıyor (şu an bizim için risk değil
ama not edilmeye değer).

**Plan Maddesi 3a — ✅ TAMAMLANDI (bkz. Tamamlanan bölümü).**

**Plan Maddesi 3b — Kullanıcı tarafında doğrulama (kod değişikliği
değil, bir eylem):** Kullanıcının GitHub reponun **Actions** sekmesine
girip "Serper Trend Taramasi" workflow'unun son çalışma zamanlarını ve
loglarını kontrol etmesi gerekiyor — bu, gecikme mi yoksa gerçek bir
hata mı (secret eksik, kelime listesi boş, kota bitmiş vb.) olduğunu
kesin olarak ayıracak tek yol. Ben (AI) bu repoya/Actions loglarına
erişemediğimden bunu tahminden öteye taşıyamıyorum.

- İlişkili: İş 6 (sistem durumu göstergesi), bu tür durumları bir
  dahaki sefere arayüzden görünür kılacak.

---

### İş 4 — 🐞 Hata: "Sıralama" ve "Yeni Trend" sekmeleri hep boş kalıyor

**Teşhis:** `compare_engine.py`'deki `determine_event_type()`, bir
run'daki TÜM kelimelerin değişikliklerine bakıp tek bir "kazanan" tip
seçiyor (öncelik sırası: `yeni_rakip` > `siralama_degisti` >
`yeni_trend`). `runs.event_type` kolonu run başına TEK bir etiket
tutuyor ve `docs/public/js/feed.js`'deki `renderFeed()` filtresi de
SADECE bu tek etikete bakıyor:

```
state.allRuns.filter((r) => r.event_type === state.currentFilter)
```

Sonuç: bir run'da 5 kelime taransa ve 1 kelimede yeni rakip, başka bir
kelimede sıralama değişimi çıksa, run'un `event_type`'ı "yeni_rakip"
olarak kaydediliyor ve o run **sadece** "Yeni Rakip" sekmesinde
görünüyor — sıralama değişimi verisi `runs.details` (jsonb) içinde
GERÇEKTEN saklanmış olsa da "Sıralama" sekmesinde hiç görünmüyor.
`yeni_rakip`, `siralama_degisti`'den ve o da `yeni_trend`'den daha sık
tetiklendiği için (bkz. İş 5), bu iki sekme pratikte hep boş kalıyor.
Bu veri kaybı değil, sadece bir GÖRÜNÜRLÜK/filtreleme sorunu — veri
zaten `details` içinde duruyor.

**Plan Maddesi 4a — ✅ TAMAMLANDI (bkz. Tamamlanan bölümü).**

**Plan Maddesi 4b (opsiyonel, 4a tamamlandıktan SONRA uygulanabilir,
AYRI adım — henüz başlanmadı):** Kartın kendisinde birden fazla etiket
gösterme (örn. "Yeni Rakip + Sıralama Değişimi" ikili rozet). Bu
`ui-context.md`'de tanımlı `feed-card-icon`'un tek renk/tek ikon
varsayımını değiştiren bir tasarım kararı gerektiriyor. Açık Soru 3'e
kullanıcı "sen en mantıklısını seç" dedi — yani tasarım kararı AI'ye
bırakıldı, ama bu henüz bir sonraki tek-madde turunda ele alınmadı;
şimdilik uygulamaya alınmadı.

---

### İş 5 — (opsiyonel) Sınırdaki gürültülü "yeni rakip" false-positive'lerini azaltma

**Teşhis/gözlem:** `compare_engine.py`'de `TOP_N = 10` sınırında,
Google SERP'lerinin doğal oynaklığı (aynı sorgu kısa aralıklarla
tekrar atıldığında 10./11. sıradaki domainlerin yer değiştirmesi gibi)
kolayca "yeni rakip" olarak işaretlenebiliyor — bu, izleme/uyarı
araçları literatüründeki klasik "alert fatigue" (uyarı yorgunluğu)
paternine tam uyuyor: anlamsız/gürültülü uyarılar kullanıcının gerçek
sinyale güvenini azaltıyor. Bu aynı zamanda İş 4'te "yeni_rakip"in
diğer kategorileri neden bu kadar sık bastırdığını da açıklıyor
olabilir.

**Plan Maddesi 5 (backend, İş 4'ten TAMAMEN ayrı bir adım):**
`compare_engine.py`'de bir domainin "yeni rakip" sayılması için sadece
son taramada değil, üst üste 2 taramada da mevcut/yok olması şartı
eklenebilir ("doğrulanmış değişiklik" — 1 taramalık dalgalanmayı
gürültü sayıp bildirmeme). Bunun için `scan.py`'de şu an sadece EN SON
1 snapshot çekilen `get_last_snapshot`'ın, 2 önceki snapshot'ı da
çekecek şekilde genişletilmesi gerekir.

- Etkilenen dosyalar: `compare_engine.py`, `scan.py`
- Dikkat: `code-standards.md` (Python) — type hints, `user_id`
  filtresi her sorguda korunacak.
- **Bu madde tamamen opsiyonel ve bir tasarım tercihi** — gerçek küçük
  rekabet hareketlerini de gizleme riski var. Kullanıcı onayı/kararı
  gerekiyor, bkz. Açık Sorular.

---

### İş 6 — Sistem durumu göstergesi: son tarama / sıradaki tarama

**Gerekçe:** Hem İş 3'ün teşhisini kolaylaştırmak hem de genel
kullanıcı yararı için — kullanıcı şu an "tarama gerçekten çalışıyor
mu, ne zaman çalıştı, sıradaki ne zaman?" sorusuna arayüzden hiç
cevap bulamıyor.

**Plan Maddesi 6a:** `state.allRuns[0].run_time` (zaten `loadRuns()`
ile çekiliyor, EK SORGU GEREKMİYOR) ve kullanıcının ayarlar
modalındaki interval değeri kullanılarak "Son tarama: X önce" +
"Sıradaki tarama: ~X sonra (tahmini)" bilgisi feed başlığına veya
ayarlar modalına eklenecek.

- Etkilenen dosyalar: `docs/public/js/feed.js` (veya küçük bir yeni
  modül), `docs/index.html` (küçük bir UI elemanı),
  `docs/public/style.css` (mevcut `:root` token'ları ile)
- Dikkat: `code-standards.md` — renk hardcode edilmeyecek; gösterilen
  metin "tahmini" olarak işaretlenecek (GitHub Actions gecikmesi
  yüzünden gerçek zamanı garanti edemiyoruz — bkz. İş 3).

**Plan Maddesi 6b (opsiyonel, şema+backend gerektirir, AYRI adım):**
`scan.py`'nin taramayı ATLADIĞI durumlar (aktif kelime yok, kota
bitti, sıklık dolmadı) şu an sadece GitHub Actions loglarına yazılıyor,
kullanıcı göremiyor. Bunu arayüzde göstermek için `runs` tablosuna
(veya `runs.details`'e) bir "atlanma nedeni" alanı eklemek gerekir —
bu bir şema kararı, bkz. Açık Sorular.

---

### İş 7 — Kendi alan adını (hedef domain) işaretleyip özel takip etme

**Gerekçe (araştırma):** İncelenen rakip araçların hemen hepsinde
(rank tracker'lar) en temel özellik "hangi domain SİZİN" bilgisini
tutup, ona özel "Competitor Outranks" tipi bir uyarı üretmek. Şu anki
uygulama ise sadece genel top-10 domain setindeki değişiklikleri
görüyor, "benim sitem" diye bir kavramı hiç bilmiyor — kullanıcı için
en kritik bilgi ("kendi sıralamam yükseldi mi düştü mü") şu an hiçbir
yerde açıkça gösterilmiyor.

**Plan Maddesi 7 (şema ÖNCE, korumalı dosya — açık onay istiyorum):**
`keywords` tablosuna opsiyonel bir `target_domain` kolonu eklenecek.
Şema doğrulandıktan SONRA:

- `compare_engine.py`: `target_domain` girilmişse, o domainin
  `new_organic`/`old_organic` içindeki pozisyonunu ayrıca hesaplayıp
  `own_position`, `own_position_change` gibi alanlar döndürecek.
- `docs/public/js/keywordsModal.js`: kelime satırına opsiyonel bir
  "kendi siten (opsiyonel)" input alanı eklenecek.
- `docs/public/js/feed.js` (detay render): kendi domain bilgisi varsa
  öne çıkan bir şekilde gösterilecek (örn. "🔺 Senin sitenin pozisyonu:
  4 → 7").

- Etkilenen dosyalar: `schema.sql` (⚠️ korumalı), `compare_engine.py`,
  `keywordsModal.js`, `feed.js`
- Dikkat: `ai-workflow-rules.md` — "şema değişikliği + tüketen kod"
  bölme kuralı: önce şema Supabase'de doğrulanacak, SONRA
  `compare_engine.py`, SONRA frontend, sırayla ve ayrı ayrı.
- **Bu, bu oturumun önerdiği en büyük/en yeni özellik** — tasarım
  kararı gerektiriyor, bkz. Açık Sorular.

---

### İş 8 — Email bildirim sistemi (plan.md madde 5-6'nın uygulanması)

**Gerekçe:** Bu zaten `plan.md`'de (madde 5-6) ve
`progress-tracker.md`'nin eski "Sırada" bölümünde tanımlı, henüz
başlanmamış bir hedefti. Kullanıcının "otomasyon" vurgusuna en çok
uyan, en somut kazanç sağlayacak madde bu — bu yüzden "Sırada"dan
çıkarıp "Şu Anki Hedef"e alıyorum.

**Plan Maddesi 8a (şema, korumalı dosya — açık onay istiyorum):**
`profiles` tablosuna bir `email_notifications_enabled boolean default
false` kolonu eklenecek. `profiles.email` zaten (v4 trigger'ı
sayesinde) mevcut olduğundan, `plan.md`'nin "Connect to Mail" fikri
BASİTLEŞİYOR — ayrı bir email toplama adımı gerekmiyor, sadece
açma/kapama anahtarı yeterli. Not: bu kolon `shared_key_scans_used`
gibi korumaya (trigger'a) gerek duymuyor — kullanıcı kendi bildirim
tercihini istediği gibi değiştirebilmeli, mevcut
`users_own_profile_update` politikası bunun için yeterli.

**Plan Maddesi 8b (backend, 8a doğrulandıktan SONRA, ayrı adım):**
`scan.py`, bir kullanıcının taraması `event_type != 'degisiklik_yok'`
VE `email_notifications_enabled = true` ile bittiyse Resend REST
API'sine (ekstra SDK değil, `requests` ile — minimal bağımlılık
ilkesi) bir özet mail gönderecek.

- Yeni secret: `RESEND_API_KEY` → GitHub Secrets'a eklenmesi
  gerekiyor, `README.md` güncellenecek.
- Dikkat: `architecture.md` invariant 1 ile aynı mantık —
  `RESEND_API_KEY` asla `docs/` altına yazılmaz, sadece GH Actions
  ortamında kalır.
- Not: Resend'in ücretsiz katmanı ayda 3.000 / günde 100 email ile
  sınırlı — bu ölçekteki kişisel/küçük ekip kullanımı için fazlasıyla
  yeterli, "tamamen ücretsiz katman" ilkesi bozulmuyor. Ayrıca
  sistem zaten sadece "değişiklik var" run'larında mail atacağı için
  (routine "değişiklik yok" taramalarında mail YOK), günlük 100 sınırı
  pratikte hiç zorlanmayacak.

**Plan Maddesi 8c (frontend, 8b'den SONRA, ayrı adım):**
`settingsModal.js`'e bir bildirim toggle'ı (checkbox) eklenecek,
`saveSettings()` bu değeri `profiles.email_notifications_enabled`'a
yazacak.

- **Görsel tercih Açık Soru'ya bağlı** — `plan.md`'deki "kırmızı-beyaz
  Gmail temalı buton" fikri mi, yoksa sade bir Ayarlar toggle'ı mı?

---

## Açık Sorular

1. **(İş 3)** Tarama sıklığı üç yerde farklı yazıyor: `scan.yml`
   yorumu "6 saat", `architecture.md` "10 dakika", gerçek `cron` değeri
   "5 dakika". Hangisi doğru/istenen production değeri? Onu tek
   doğruluk kaynağı yapıp diğer ikisini ona göre düzelteceğim.
   Cevap> Production degeri olarak 1 saat yapalim fakat kisi ayarlayabilsin yine. Test icin yine 1dk 5dk gibi degerler kalsin sonrasinda onlar kaldirilacak.
2. **(İş 3)** GitHub reponun **Actions** sekmesine girip "Serper Trend
   Taramasi" workflow'unun son çalışma geçmişini/loglarını
   kontrol edebilir misin? Gecikme mi (GitHub'ın "best effort"
   zamanlaması) yoksa gerçek bir hata mı (secret, boş kelime listesi,
   kota) olduğunu bu şekilde kesinleştirebiliriz.
   Cevap> Is 3u yapacagimiz zaman bunu benden iste sana yollayayim.
3. **(İş 4 / 4b)** Bir run'ın feed kartında birden fazla değişiklik
   tipini aynı anda göstermek (örn. iki rozet) ister misin, yoksa 4a
   (sadece sekme filtresini düzeltme) şimdilik yeterli mi?
   Bunu sen en mantiklisini sec bilmiyorum
4. **(İş 5)** "Sınırdaki gürültülü yeni rakip" false-positive'lerini
   azaltmak için 2-taramalık doğrulama mantığı ister misin? Bu, bazı
   küçük/gerçek rekabet hareketlerinin de 1 tur gecikmeli
   bildirilmesi anlamına gelir — bu ödünleşmeyi kabul eder misin, yoksa
   ham hassasiyet korunsun mu?
   Eger ki gercekten dogru cevap vermekde problem cikartacaksa kabul ederim fakat su anda zaten guzel cevaplar aliyorsak gerek yok
5. **(İş 6b)** Taramanın "atlandı" nedenini arayüzde göstermek
   istiyor musun (şema değişikliği gerektiriyor), yoksa 6a (son/sıradaki
   tarama zamanı) şimdilik yeterli mi?
   Gosterelim
6. **(İş 7)** `target_domain` her KELİME için mi ayrı ayrı girilecek
   (ajans/çoklu müşteri senaryosu), yoksa profil bazında TEK bir
   "benim sitem" alanı mı yeterli (tek kullanıcı, tek site senaryosu)?
   Bu, şema tasarımını doğrudan etkiliyor.
   Coklu musteri senaryosu olmasi lazim fakat bunu her kullanici degil isteyen kullanicilar kullanacak bunu aktif edilip deaktivite edilebilir seklinde yapacaksin sonucta tek musterimiz vayes degil.
7. **(İş 8c)** Bildirim açma/kapama için `plan.md`'deki "kırmızı-beyaz
   Gmail temalı buton" fikri mi, yoksa Ayarlar modalında sade bir
   toggle mı?
   Bildirim isi tamamen yok oldu bildirim yok. Bildirimi yapmamiz icin para gerekiyor. Ucretsiz bir yolu yokmus gmail notification olayinin
8. **(genel öncelik)** Yukarıdaki maddelerden hangilerini bu sprintte,
   hangilerini "Sırada"da bırakmamı istersin? (Önerim: önce İş 3/4 —
   hata düzeltmeleri — sonra İş 6, sonra İş 8, İş 7 ve İş 5 en son.)
   Sen belirle.

---

## Devam Eden

- Yok.

## Sırada

Bu oturumda "Şu Anki Hedef"e taşınmayan, daha spekülatif/büyük
kapsamlı fikirler — kullanıcı önceliklendirmesi olmadan başlanmayacak:

1. **Haftalık/günlük özet e-postası** — anlık uyarıya ek/alternatif
   olarak, alert-fatigue azaltmak için yaygın bir pattern (araştırılan
   rakip araçların çoğunda var). İş 8 çalışıp test edilmeden mantıklı
   değil; kendi cron'unu (haftalık ayrı bir workflow) gerektirir.
2. **Kelime bazlı pozisyon geçmişi / mini-grafik** — `keyword_snapshots`
   zaten geçmişi tutuyor, ama bunu bir trend grafiğine çevirmek yeni
   bir agregasyon sorgusu + inline SVG çizim gerektirir (harici
   charting kütüphanesi YOK — `code-standards.md` minimal bağımlılık
   ilkesi). İş 7 (kendi domain) ile birlikte düşünülürse çok daha
   değerli olur.
3. **Manuel "Şimdi Tara" butonu** — GitHub Actions'ı frontend'den
   tetiklemek bir GitHub token'ının bir yerde (Vercel serverless
   function veya üçüncü parti bir cron servisi) saklanmasını
   gerektiriyor; bu, projenin "sunucu gerektirmeyen" mimari
   ilkesini (`project-overview.md`) doğrudan etkileyen bir mimari
   karar — `architecture.md`'nin güncellenmesini de gerektirir.
   Açık onay/tartışma gerekiyor, bu yüzden şimdilik sadece not
   edildi, plana alınmadı.

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

- **Dokümantasyon senkron hatası düzeltildi:** Önceki oturumun
  hedefleri olan İş 1 (otomatik profil oluşturma trigger'ı) ve İş 2
  (Realtime canlı güncelleme, 2a+2b) kod tabanında (`schema.sql`
  v4/v5, `auth.js`, `feed.js`) FİİLEN tamamlanmış durumdaydı, ama bu
  dosyanın "Tamamlanan" bölümü hiç güncellenmemişti —
  `ai-workflow-rules.md`'nin "her anlamlı değişiklikten sonra
  progress-tracker.md güncellenir" kuralı bir önceki oturumda
  atlanmış. Bu oturumda düzeltildi.
- **Bu oturumun talebi:** Kullanıcı, bu projenin kendisine verilmiş
  bir otomasyon görevi olduğunu ve olabildiğince faydalı/iyi bir sonuç
  çıkarmak istediğini belirtti; bu yüzden özellik önerileri
  "sadece bildirilen hataları düzelt" ötesine geçecek şekilde,
  araştırmaya dayalı ve kapsamlı tutuldu — ama şema değiştiren hiçbir
  madde kullanıcı onayı olmadan uygulanmayacak (bkz. Açık Sorular).
- **Araştırma yöntemi:** Benzer SEO rank tracker / SERP izleme
  araçlarının (rakip alanı takibi, özet e-posta raporları,
  yapılandırılabilir uyarı koşulları, "false positive" azaltma
  pratikleri) ve GitHub Actions'ın zamanlanmış görev güvenilirliğine
  dair genel davranışları web araştırmasıyla incelendi; bulgular
  yukarıdaki maddelerin gerekçelerine yansıtıldı (kaynaklar sohbet
  yanıtında paylaşıldı, bu dosyaya eklenmedi).
- Bir sonraki oturuma başlarken: önce `CLAUDE.md`'yi, sonra sırasıyla
  `context/project-overview.md` → `architecture.md` → `ui-context.md`
  → `code-standards.md` → `ai-workflow-rules.md` →
  `progress-tracker.md`'yi oku.