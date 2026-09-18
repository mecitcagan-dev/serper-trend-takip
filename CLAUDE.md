## Application Building Context

Bu, **Serper Trend Takip** projesinin kök dizinindeki `CLAUDE.md`
dosyasıdır. Herhangi bir yapay zeka asistanı (Claude, ChatGPT, Cursor
vb.) bu projede çalışmaya başlamadan önce aşağıdaki sırayla dosyaları
okumalı:

1. `context/project-overview.md` — ürün tanımı, hedefler, özellikler,
   kapsam
2. `context/architecture.md` — sistem yapısı, sınırlar, storage
   modeli, değişmezler (invariants)
3. `context/ui-context.md` — tema, renkler, tipografi, component
   konvansiyonları
4. `context/code-standards.md` — uygulama kuralları ve konvansiyonlar
5. `context/ai-workflow-rules.md` — geliştirme iş akışı, kapsam
   kuralları, teslimat yaklaşımı
6. `context/progress-tracker.md` — şu anki faz, tamamlanan iş, açık
   sorular, sıradaki adımlar

## Repo Yerleşimi (hızlı özet)

- `docs/` — statik frontend (Vercel bu klasörü servis eder), vanilla
  JS ES modules
- kök dizin — Python otomasyonu (`scan.py`, `serper_client.py`,
  `compare_engine.py`), `schema.sql`, `README.md`, `plan.md`
- `.github/workflows/` — cron tanımı
- `context/` — bu dosyanın referans verdiği altı bağlam dosyası

## Kurallar

- Her anlamlı uygulama değişikliğinden sonra
  `context/progress-tracker.md` güncellenir.
- Uygulama, mimariyi, kapsamı veya `context/` dosyalarında belgelenen
  standartları değiştiriyorsa, devam etmeden önce ilgili dosya
  güncellenir.
- **Yeni bir dosya, klasör oluşturuluyorsa veya var olan bir dosya/
  klasör taşınıyorsa/siliniyorsa/adı değiştiriliyorsa**,
  `context/architecture.md` içindeki "Klasör Yapısı" ağacı AYNI ADIMDA
  güncellenir — bu ağaç, dosyalar klasörsüz/flat olarak (ör. bir AI
  "project" özelliğine) yüklendiğinde tek gerçek referans olduğu için
  gerçek dosya sisteminden kopması kabul edilmez.
- Aksi açıkça istenmedikçe **yeni ürün özelliği eklenmez** — bkz.
  `context/ai-workflow-rules.md` ve `context/progress-tracker.md`'deki
  "Sırada" bölümü, davranış oradan çıkarılır.
