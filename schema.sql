-- Serper Trend Takip - Supabase şeması (v2 - kullanıcı izolasyonu)
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" de.
-- Bu dosya hem sıfırdan kurulum hem de eski (v1) bir projeden geçiş için
-- güvenlidir — IF NOT EXISTS / IF EXISTS kullanıldığından tekrar tekrar
-- çalıştırılabilir.

create table if not exists keywords (
  id bigint generated always as identity primary key,
  keyword text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id bigint generated always as identity primary key,
  run_time timestamptz not null,
  event_type text not null,        -- 'yeni_rakip' | 'siralama_degisti' | 'yeni_trend' | 'degisiklik_yok'
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists keyword_snapshots (
  id bigint generated always as identity primary key,
  run_id bigint references runs(id) on delete cascade,
  keyword text not null,
  organic jsonb,
  people_also_ask jsonb,
  related_searches jsonb,
  created_at timestamptz not null default now()
);

alter table keywords enable row level security;
alter table runs enable row level security;
alter table keyword_snapshots enable row level security;

-- Eski (v1) "giriş yapan herkes her şeyi görsün" kuralları varsa temizle —
-- bu tam olarak "dünkü taramalar da sana görünüyor" sorununun sebebiydi.
drop policy if exists "anon_select_runs" on runs;
drop policy if exists "anon_select_snapshots" on keyword_snapshots;
drop policy if exists "anon_select_keywords" on keywords;
drop policy if exists "anon_insert_keywords" on keywords;
drop policy if exists "anon_update_keywords" on keywords;
drop policy if exists "anon_delete_keywords" on keywords;
drop policy if exists "authenticated_select_runs" on runs;
drop policy if exists "authenticated_select_snapshots" on keyword_snapshots;
drop policy if exists "authenticated_select_keywords" on keywords;
drop policy if exists "authenticated_insert_keywords" on keywords;
drop policy if exists "authenticated_update_keywords" on keywords;
drop policy if exists "authenticated_delete_keywords" on keywords;

-- =============================================================
-- v2: Kullanıcı bazlı veri izolasyonu + kişiye özel Serper API key
-- =============================================================

-- 1. profiles tablosu (her kullanıcının kendi Serper key'ini tutar)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  serper_api_key text,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

drop policy if exists "users_own_profile_select" on profiles;
drop policy if exists "users_own_profile_insert" on profiles;
drop policy if exists "users_own_profile_update" on profiles;

create policy "users_own_profile_select" on profiles
  for select to authenticated using (id = auth.uid());
create policy "users_own_profile_insert" on profiles
  for insert to authenticated with check (id = auth.uid());
create policy "users_own_profile_update" on profiles
  for update to authenticated using (id = auth.uid());

-- 2. keywords — user_id ekle
alter table keywords add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "user_select_keywords" on keywords;
drop policy if exists "user_insert_keywords" on keywords;
drop policy if exists "user_update_keywords" on keywords;
drop policy if exists "user_delete_keywords" on keywords;

-- Sahipsiz (eski/anonim) kelimeler silinir
delete from keywords where user_id is null;

create policy "user_select_keywords" on keywords
  for select to authenticated using (user_id = auth.uid());
create policy "user_insert_keywords" on keywords
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_update_keywords" on keywords
  for update to authenticated using (user_id = auth.uid());
create policy "user_delete_keywords" on keywords
  for delete to authenticated using (user_id = auth.uid());

-- 3. runs — user_id ekle
alter table runs add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "user_select_runs" on runs;

-- Sahipsiz (eski/anonim) çalıştırmalar silinir — "dünkü taramalar" burada temizlenir
delete from runs where user_id is null;

create policy "user_select_runs" on runs
  for select to authenticated using (user_id = auth.uid());

-- 4. keyword_snapshots — user_id ekle
alter table keyword_snapshots add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "user_select_snapshots" on keyword_snapshots;

delete from keyword_snapshots where user_id is null;

create policy "user_select_snapshots" on keyword_snapshots
  for select to authenticated using (user_id = auth.uid());

-- 5. settings — (user_id, key) unique olacak şekilde yeniden oluştur
-- (v1'de bu tablonun hiç policy'si yoktu, bu yüzden RLS varsayılan olarak
-- her isteği reddediyordu — arayüzdeki tarama sıklığı kaydı hiç çalışmıyordu.)
drop table if exists settings;
create table settings (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  unique(user_id, key)
);
alter table settings enable row level security;

create policy "user_select_settings" on settings
  for select to authenticated using (user_id = auth.uid());
create policy "user_insert_settings" on settings
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_update_settings" on settings
  for update to authenticated using (user_id = auth.uid());

-- 6. GRANT izinleri (Supabase bazı kurulumlarda public şemadaki tablolara
-- authenticated rolüne otomatik yetki vermeyebilir; garantiye alıyoruz)
grant select on public.runs to authenticated;
grant select on public.keyword_snapshots to authenticated;
grant select, insert, update, delete on public.keywords to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Not: GitHub Actions script'i (scan.py) service_role key kullanır,
-- bu RLS'i otomatik bypass eder (bypassrls). Yukarıdaki kurallar sadece
-- giriş yapmış frontend kullanıcıları içindir — her kullanıcı sadece
-- kendi user_id'siyle eşleşen satırları görür/değiştirir.