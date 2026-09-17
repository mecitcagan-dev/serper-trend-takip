# Yapılacaklar

## 1. Dil tutarlılığı

- [x] Tüm görünür arayüz metinleri Türkçe (kod içi değişken/fonksiyon isimleri İngilizce kalıyor)

## 2. Kayıt / Giriş sistemi (Supabase Auth)

- [x] Email + şifre ile kayıt, giriş
- [x] Şifre min. 8 karakter (istemci tarafında ve Supabase tarafında doğrulanıyor)
- [x] Aynı email ile ikinci kayıt engellenir (Supabase native + Türkçe hata mesajı)
- [x] Oturum tarayıcıda kalıcı (supabase-js varsayılan `persistSession`) — çıkıp tekrar girince otomatik giriş
- [x] Login olmadan siteye erişilemez (gate ekranı, `.hidden` ile app gizleniyor)
- [x] Hata durumları Türkçeleştirilip kullanıcıya gösteriliyor: boş email, geçersiz email formatı, boş şifre, kısa şifre, yanlış email/şifre, zaten kayıtlı email, onaylanmamış email, rate limit

## 3. Kullanıcı bazlı veri izolasyonu

- [ ] `keywords`, `runs`, `keyword_snapshots` tablolarına `user_id` kolonu ekle
- [ ] RLS policy'lerini `user_id = auth.uid()` şartıyla güncelle
- [ ] `scan.py`'yi her kullanıcının kendi kelime listesini kendi Serper key'iyle tarayacak şekilde yeniden yaz

## 4. Kişiye özel Serper API key

- [ ] `users` (profil) tablosuna `serper_api_key` kolonu
- [ ] Arayüzden kullanıcı kendi key'ini girip kaydedebilsin (Supabase + localStorage cache)
- [ ] `scan.py` ortak `SERPER_API_KEY` yerine kullanıcının kendi key'ini kullansın

## 5. "Connect to Mail" butonu

- [ ] Sağ altta kırmızı-beyaz Gmail temalı buton
- [ ] Login'li kullanıcının email'i ile tek tıkla "connect" (tabloya/kolona işaretlenir)

## 6. Email bildirim sistemi

- [ ] Yeni aktivite (`event_type != degisiklik_yok`) tespit edilince mail'i connect etmiş kullanıcıya otomatik mail
- [ ] Resend ile gönderim, API key GitHub Secrets'a eklenecek
