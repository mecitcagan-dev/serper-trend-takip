# AI Workflow Rules

## Yaklaşım

Bu proje artık büyük ölçüde tamamlanmış, çalışan bir uygulama — yeni
bir yapay zeka asistanına iş verilirken varsayım şu: **aksi açıkça
belirtilmedikçe yeni ürün özelliği EKLENMİYOR**, sadece (a)
`plan.md`'deki henüz yapılmamış maddeler, (b) açıkça istenen bug
fix/refactor/organizasyon işleri yapılıyor. Her görevden önce
`context/` klasöründeki dosyalar ve `plan.md` okunur, davranış oradan
çıkarılır — sıfırdan uydurulmaz.

## İki Aşamalı Çalışma: Önce Plan, Sonra Uygulama

Her görev iki ayrı aşamada yürütülür, AI bu iki aşamayı ASLA
birleştirmez:

**Aşama 1 — Planlama:** Kullanıcı yapılacak işi (tek veya birden
fazla madde halinde) detaylı anlatır. AI bunu context dosyalarıyla
karşılaştırır ve **kod yazmadan önce**, `context/progress-tracker.md`
içindeki "Şu Anki Hedef" bölümüne madde madde bir plan yazar. Her
madde şunu içerir: ne yapılacak, hangi dosya(lar) etkilenecek, hangi
context kuralına (invariant, kod standardı vb.) dikkat edilmesi
gerektiği. Belirsiz bir nokta varsa plana madde olarak eklenmez,
"Açık Sorular" bölümüne yazılıp kullanıcıya sorulur. Bu aşamada
HİÇBİR kod dosyası değiştirilmez — sadece `progress-tracker.md`
güncellenir ve kullanıcıdan onay istenir.

**Aşama 2 — Uygulama:** Kullanıcı planı onayladıktan (veya
düzelttikten) SONRA başlar. Onaylanan maddeler, aşağıdaki "İşi Ne
Zaman Bölmeli" kuralına göre sırayla uygulanır. Her madde
tamamlandığında kısa bir doğrulama notu verilir.

Bu akış atlanmaz — kullanıcı açıkça "planı atla, direkt uygula" demediği
sürece her görev Aşama 1 ile başlar.

## Kapsam Kuralları

- Aynı anda tek bir özellik/birim üzerinde çalışılır.
- Küçük, uçtan uca doğrulanabilir artışlar tercih edilir; büyük
  spekülatif değişikliklerden kaçınılır.
- Tek bir uygulama adımında ilgisiz sistem sınırları birleştirilmez
  (örn. frontend UI değişikliği ile `scan.py` mantığı aynı adımda
  değiştirilmez).

## İşi Ne Zaman Bölmeli

Bir uygulama adımı şunları birleştiriyorsa bölünmeli:

- Frontend (`docs/`) değişikliği + otomasyon (`scan.py`/
  `compare_engine.py`) değişikliği
- Şema değişikliği (`schema.sql`) + o şemayı tüketen frontend/backend
  kodu — ÖNCE şema migrate edilir ve Supabase'de doğrulanır, SONRA
  tüketen kod güncellenir
- `context/architecture.md`'de tanımlanmamış/belirsiz bir davranış

Bir değişiklik uçtan uca hızlıca doğrulanamıyorsa, kapsam çok
geniştir — bölünmeli.

## Eksik Gereksinimleri Ele Alma

- `context/*.md` dosyalarında tanımlanmamış ürün davranışı UYDURULMAZ.
- Bir gereksinim belirsizse, uygulamaya geçmeden önce ilgili context
  dosyasında netleştirilir (kullanıcıya sorularak).
- Bir gereksinim eksikse, devam etmeden önce
  `context/progress-tracker.md`'ye açık soru olarak eklenir.

## Korumalı Dosyalar

Açıkça talimat verilmedikçe değiştirilmez:

- `schema.sql` — RLS policy'lerini değiştirmek tüm kullanıcıların veri
  izolasyonunu etkiler, dikkatli inceleme gerektirir
- `SUPABASE_SERVICE_KEY` kullanan hiçbir kod `docs/` altına
  taşınmaz/yazılmaz
- `docs/config.js` — elle düzenlenmez, sadece build script üretir

## Dokümanları Senkron Tutma

Uygulama şunlardan herhangi birini değiştiriyorsa ilgili context
dosyası güncellenir:

- Sistem mimarisi veya sınırları → `architecture.md`
- Storage model kararları → `architecture.md`
- **Dosya/klasör eklendi, silindi, taşındı veya yeniden adlandırıldı**
  → `architecture.md`'deki "Klasör Yapısı" ağacı, AYNI ADIMDA
  (sonraya bırakılmadan)
- Kod konvansiyonu/standartları → `code-standards.md`
- Özellik kapsamı → `project-overview.md`

Klasör ağacı diğerlerinden farklı olarak "hatırlanınca güncellenir"
değil, "her dosya sistemi değişikliğinde otomatik olarak güncellenir"
kuralına tabidir — çünkü bu proje flat/context tabanlı bir ortama
(bkz. `CLAUDE.md`) yüklenebiliyor ve orada gerçek dosya sistemi
görünmüyor.

## Bir Sonraki Birime Geçmeden Önce

1. Mevcut birim, tanımlı kapsamı içinde uçtan uca çalışıyor
2. `architecture.md`'de tanımlı hiçbir değişmez (invariant) ihlal
   edilmedi
3. `progress-tracker.md` tamamlanan işi yansıtıyor
4. Frontend değiştiyse: sayfa tarayıcıda elle test edildi (otomatik
   test altyapısı yok); backend değiştiyse: `scan.py` yerelde
   `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` ile manuel çalıştırılıp
   doğrulandı
