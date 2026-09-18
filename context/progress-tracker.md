# Progress Tracker

## Aktif İş

GitHub Actions üzerinden `scan.py` çalışıyor görünse de 5 dakikalık
tarama ayarında beklenen sonuçlar zamanında oluşmuyor.

## Plan

1. Workflow tetiklenmesini, secret/dependency hatalarını ve `scan.py`
   çıktısını Actions loglarından ayırarak teşhis et.
2. GitHub Actions workflow’unu ve gerekli gözlemlenebilirlik kontrollerini
   düzelt; manuel tetikleme ile doğrula.
3. Kullanıcı tarama sıklığı ile GitHub cron sıklığını netleştir; 1 ve 5
   dakikalık test seçeneklerini koru, üretim varsayılanını ayrı tut.
4. GitHub cron güvenilirliği yeterli değilse ücretsiz bir scheduler/backend
   alternatifi değerlendir ve mevcut Supabase + `scan.py` akışına bağla.
5. Çalışan çözümü README ve bu tracker'da kısa şekilde belgele.

## Karar Kriteri

Her çalıştırmada logda başlangıç, Supabase bağlantısı, profil/kelime sayısı
ve sonuç görünmeli; başarılı tarama `runs` tablosunda kayıt oluşturmalı.
GitHub Actions'ın best-effort zamanlaması 5 dakikalık ihtiyacı karşılamıyorsa
alternatif ücretsiz scheduler kullanılacak; uygun ve güvenilir seçenek yoksa
bu sınırlama teslim notuna açıkça yazılacak.

## Durum

- Tracker kısaltıldı.
- Canlı loglar incelendi: önceki hata `service_role` için Supabase tablo
  yetkisiydi; `schema.sql` içinde gerekli `GRANT`'lar mevcut.
- Manuel Actions çalıştırmaları başarılı; son commit'ten sonra beklenen
  schedule çalıştırmaları oluşmadı.
- Workflow fix'i hazırlandı: offset'li 5 dk cron, concurrency, timeout,
  secret preflight ve canlı Python logu.
- README'ye ücretsiz cron-job.org → `workflow_dispatch` fallback'i eklendi.
- Değişikliklerin GitHub'a gönderilip schedule/fallback ile doğrulanması
  gerekiyor.
