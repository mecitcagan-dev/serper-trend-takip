# Progress Tracker

## Aktif Faz

Otomasyon tamamlandı. Sıradaki hedef, mevcut SERP değişiklik takip aracını
Vayes'in SEO/GEO ajans operasyonunda kullanılabilir, çok müşterili bir iç
ürüne dönüştürmek.

Bu dosya şu anda yalnızca uygulama planıdır. Maddeler sırayla, her biri
tamamlanıp doğrulandıktan sonra bir sonraki maddeye geçilerek uygulanacaktır.

## Ücretsiz teknoloji sınırı

- Yeni ücretli servis, ücretli API veya ücretli hosting eklenmeyecek.
- Mevcut ücretsiz Supabase, GitHub Actions, cron-job.org ve Serper ücretsiz
  kullanım hakkı birlikte kullanılacak.
- Ücretli bir özellik zorunlu hâle gelirse bunun yerine ücretsiz içe aktarma,
  tarayıcı içinde üretim veya manuel doğrulama akışı konulacak.

## Uygulama Sırası

### 1. Müşteri ve proje ayrımı — Kod/migration hazır

- Her kullanıcı birden fazla müşteri/proje oluşturabilecek.
- Her projenin adı, müşteri adı, hedef domaini ve aktif/pasif durumu olacak.
- Anahtar kelimeler kullanıcıya değil projeye bağlanacak.
- Mevcut kullanıcı verileri kaybolmadan varsayılan bir projeye taşınacak.
- RLS, bir kullanıcının yalnızca kendi projelerini ve proje verilerini
  görebilmesini sağlayacak.

**Tamamlanma ölçütü:** Aynı hesapta en az iki müşteri projesi oluşturulup
verileri birbirinden izole biçimde görüntülenebilmeli.

**Kontrol:** Proje tablosu, varsayılan proje backfill'i, proje bağlamlı kelime/
tarama sorguları ve RLS kuralları eklendi; Python ve JavaScript statik kontrolleri
geçti. Canlı kabul için Supabase SQL Editor'de `schema.sql` içindeki v6 bölümü
bir kez çalıştırılmalı ve iki proje ile kısa bir manuel izolasyon testi yapılmalı.

### 2. Hedef domain ve gerçek sıra takibi — Kod hazır

- Proje için hedef domain tanımlanacak; gerekirse kelime bazında override
  edilebilecek.
- Her taramada hedef domainin pozisyonu, önceki pozisyonu ve değişimi
  hesaplanacak.
- İlk 10 dışında kalan hedef domain "ilk 10 dışında" olarak gösterilecek.
- Rakip domain değişimleri hedef domain sırasından ayrı gösterilecek.

**Tamamlanma ölçütü:** Bir proje ekranında her kelime için hedef domainin
mevcut sırası, önceki sırası ve yönü doğru görüntülenmeli.

**Kontrol:** Proje hedef domaini, kelime bazlı override alanı, ilk 10 pozisyonu
ve yön bilgisi eklendi. İlk ölçüm baz olarak işaretleniyor; domain ilk 10 dışına
çıktığında ayrıca gösteriliyor. Karşılaştırma motoru için 3 otomatik test ve
Python/JavaScript statik kontrolleri geçti.

### 3. Arama pazarı ve cihaz ayarları — Kod hazır

- Proje bazında ülke, dil, şehir/lokasyon ve cihaz seçilebilecek.
- Türkiye dışı ve İngilizce aramalar desteklenecek.
- Mobil ve masaüstü sonuçları ayrı izlenebilecek.
- Serper sorgusundaki sabit `gl=tr` ve `hl=tr` değerleri proje ayarlarından
  üretilecek.

**Tamamlanma ölçütü:** Aynı kelime farklı lokasyon veya cihaz ayarıyla ayrı
sonuç olarak taranabilmeli.

**Kontrol:** Proje formuna ülke, dil, lokasyon ve masaüstü/mobil seçimi eklendi;
`scan.py` bu değerleri Serper isteğine geçiriyor. Varsayılanlar Türkiye,
Türkçe ve masaüstü. İstek gövdesini doğrulayan otomatik test geçti.

### 4. Ajans dashboard'u ve proje bağlamı — Kod hazır

- Kullanıcı girişinden sonra müşteri/proje seçimi yapılabilecek.
- Dashboard yalnızca seçili projenin kelimelerini, taramalarını ve
  değişikliklerini gösterecek.
- Son tarama, sıradaki tahmini tarama, aktif kelime ve kota durumu
  gösterilecek.
- Yeni rakip, sıra değişimi ve içerik fırsatı özetleri proje bazında
  sunulacak.

**Tamamlanma ölçütü:** Vayes çalışanı müşteri değiştirince ekrandaki tüm
veriler doğru projeye göre yenilenmeli.

**Kontrol:** Seçili projeye göre aktivite akışı, kelime modalı ve ücretsiz
dashboard özeti yenileniyor. Özette son tarama, tahmini sonraki tarama, aktif
kelime sayısı ve Serper kota durumu var. Realtime yeni tarama geldiğinde özet
de yenileniyor; statik kontroller geçti.

### 5. Raporlama ve dışa aktarma

- Proje bazında tarih aralığı seçilebilecek.
- Haftalık/aylık değişim özeti oluşturulacak.
- Anahtar kelime, hedef sıra, rakip değişimi ve yeni soru verileri CSV
  olarak dışa aktarılacak.
- Müşteriye sunulabilecek sade bir rapor görünümü hazırlanacak.
- Ücretsiz e-posta bildirimi kapsam dışı tutulacak; rapor uygulama içinden
  indirilecek veya paylaşılacak.

**Tamamlanma ölçütü:** Vayes, bir müşterinin seçilen dönem raporunu tek
işlemle indirip müşteri sunumunda kullanabilmeli.

### 6. Google Search Console bağlantısı

- Kullanıcı, yetkilendirdiği Search Console mülkünü projeye bağlayabilecek.
- Kelime bazında gösterim, tıklama, CTR ve ortalama pozisyon verileri
  okunacak.
- SERP pozisyonu ile gerçek Search Console performansı aynı ekranda
  karşılaştırılacak.

**Tamamlanma ölçütü:** Bir proje için en az bir Search Console mülkünden
okuma yetkili performans verisi getirilebilmeli.

### 7. GEO/AI görünürlük modülü

- Vayes'in GEO hizmetiyle uyumlu olarak AI arama görünürlüğü ayrı bir
  özellik olarak tanımlanacak.
- Takip edilecek soru, marka adı, rakip ve kaynak domain modeli
  belirlenecek.
- Kullanılacak veri kaynağı ve ücretsiz/ücretli API sınırları netleşmeden
  uygulamaya alınmayacak.
- Google PAA ve related search verileri, AI görünürlüğünün yerine
  geçirilmeden yalnızca içerik fırsatı olarak etiketlenecek.

**Tamamlanma ölçütü:** AI görünürlüğü ölçümünün neyi, hangi kaynakla ve
hangi sıklıkta ölçtüğü kullanıcıya açıkça gösterilmeli.

### 8. Veri kalitesi, kota ve tarama maliyeti

- Çok kısa aralıkların üretimde gereksiz Serper tüketmesi engellenecek.
- Sıralama ve rakip değişimlerinde gürültü azaltma kuralı uygulanacak.
- Geçici API hatalarında kontrollü tekrar deneme yapılacak.
- Proje ve kullanıcı bazında Serper kullanım/kota görünürlüğü eklenecek.
- Aynı projenin aynı kelimesi eşzamanlı iki kez taranmayacak.

**Tamamlanma ölçütü:** Pilot kullanımda gereksiz tekrar taramalar ve
doğrulanamayan değişiklikler ölçülebilir biçimde azaltılmalı.

### 9. Ajans güvenliği ve teslim hazırlığı

- Müşteri verilerinin proje bazında RLS izolasyonu doğrulanacak.
- API anahtarlarının saklama ve erişim modeli gözden geçirilecek.
- Yetki rolleri belirlenecek: yönetici, ekip üyesi, müşteri salt-okunur.
- Silme, dışa aktarma ve erişim işlemleri için temel audit bilgisi
  tutulacak.
- Vayes kullanım senaryosu, kurulum ve pilot sonuçları teslim dokümanına
  dönüştürülecek.

**Tamamlanma ölçütü:** Vayes ekibi yeni bir müşteri projesini güvenli biçimde
oluşturup izleyebilmeli ve müşteriye yalnızca izin verilen görünümü
paylaşabilmeli.

## Pilot Doğrulama

Ürünleştirme maddeleri tamamlandıktan sonra:

- Vayes'in kendi sitesi için bir proje açılacak.
- 10–20 gerçek anahtar kelime seçilecek.
- En az bir lokal ve bir uluslararası arama senaryosu denenecek.
- Dört haftalık izleme yapılacak.
- Başarı; yakalanan gerçek değişiklik, yanlış alarm oranı, rapor hazırlama
  süresi ve ekip tarafından üretilen SEO aksiyonu ile ölçülecek.

## Mevcut Durum

- [x] GitHub Actions + cron-job.org otomasyonu çalışıyor.
- [x] `scan.py` sonuçları Supabase'e yazıyor.
- [x] Progress tracker Vayes odaklı plan hâline getirildi.
- [ ] Madde 1: müşteri/proje ayrımı.
