# Vayes Teslim Notu

## Ürünün Vayes'e katkısı

Bu uygulama, Vayes'in SEO ekiplerinin müşteri bazında Google görünürlük
değişimini izleyebileceği ücretsiz bir pilot araçtır. Her müşteri ayrı proje
olarak tutulur; hedef domain, arama pazarı, cihaz, kelime, SERP sırası ve
değişim geçmişi aynı bağlamda görünür.

## Ücretsiz çalışma modeli

- GitHub Actions + cron-job.org, `scan.py` dosyasını yaklaşık 5 dakikada bir
  tetikler.
- Kullanıcının proje ayarındaki aralık gerçek Serper taramasını belirler;
  varsayılan değer 6 saattir.
- Supabase ücretsiz veritabanı ve RLS kullanılır.
- Raporlar tarayıcıda CSV olarak üretilir veya yazdırılarak PDF'e kaydedilir.
- Serper'in ücretsiz sorgu hakkı bittiğinde kullanıcı kendi key'ini eklemelidir;
  ücretli bir servis bu projeye otomatik eklenmez.

## Kurulum sırası

1. Supabase SQL Editor'de kökteki `schema.sql` dosyasının tamamını çalıştır.
   Dosyanın v6–v13 bölümleri proje, hedef domain, pazar, kilit, audit ve
   salt-okunur rol desteğini getirir.
2. GitHub Actions secrets değerlerini kontrol et: `SUPABASE_URL`,
   `SUPABASE_SERVICE_KEY` ve `SERPER_API_KEY` veya `SHARED_SERPER_API_KEY`.
3. cron-job.org isteğinin `workflow_dispatch` endpoint'ine POST yaptığını
   doğrula. Secret'ları cron-job.org'a koyma.
4. Uygulamada proje oluştur, hedef domain/lokasyon/cihaz ayarlarını gir ve
   kelimeleri projeye ekle.
5. İlk taramadan sonra hedef sıra ve rapor ekranını pilot müşteriyle doğrula.

Search Console ve GEO modülleri bu pilot uygulamanın kapsamından çıkarıldı.
Şemadaki eski migration bölümleri daha önce kurulmuş veritabanlarında geriye
dönük uyumluluk için korunuyor; frontend bu alanlara erişmez.

## Pilot kabul listesi

- [ ] Supabase `schema.sql` migrationı çalıştırıldı.
- [ ] Aynı kullanıcı altında iki proje oluşturuldu; kelime ve aktivite verisi
      projeler arasında karışmıyor.
- [ ] Bir projede hedef domain ilk 10 içindeyken ve dışındayken sıra gösterimi
      doğrulandı.
- [ ] Farklı lokasyon/cihaz ayarıyla yeni tarama alındı.
- [ ] CSV raporu ve yazdırılabilir müşteri raporu indirildi.
- [ ] GitHub Actions ve cron-job.org loglarında başarılı tetikleme görüldü.
