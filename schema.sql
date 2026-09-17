-- Serper Trend Takip - Supabase şeması
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" de.

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

-- NOT: "settings" tablosu önceki sürümde eksikti — bu yüzden arayüzde
-- "settings" tablosuna yapılan istekler 403 dönüyordu (tablo RLS ile
-- korunuyor ama hiç policy'si yoktu / tablo hiç yoktu). Aşağıda ekleniyor.
create table if not exists settings (
  key text primary key,
  value text not null
);

-- Row Level Security açık (proje oluştururken "Enable automatic RLS" seçtiğin için
-- bu tablolar zaten varsayılan olarak kilitli geliyor olabilir - yine de garantiye alalım)
alter table keywords enable row level security;
alter table runs enable row level security;
alter table keyword_snapshots enable row level security;
alter table settings enable row level security;

-- Artık siteye girmek için giriş yapmak (Supabase Auth) zorunlu olduğundan,
-- frontend erişimi "anon" yerine "authenticated" rolüne veriliyor: sadece
-- oturum açmış kullanıcılar okuyup düzenleyebilir. NOT: bu kurallar henüz
-- kullanıcıya özel değil (user_id filtresi yok) — bu, sıradaki "kullanıcı
-- bazlı veri izolasyonu" maddesinde eklenecek.

-- Daha önce schema.sql'i çalıştırdıysan eski "anon_*" kuralları hâlâ
-- duruyor olabilir — güvenli tekrar çalıştırma için önce onları kaldırıyoruz.
drop policy if exists "anon_select_runs" on runs;
drop policy if exists "anon_select_snapshots" on keyword_snapshots;
drop policy if exists "anon_select_keywords" on keywords;
drop policy if exists "anon_insert_keywords" on keywords;
drop policy if exists "anon_update_keywords" on keywords;
drop policy if exists "anon_delete_keywords" on keywords;

create policy "authenticated_select_runs" on runs
  for select to authenticated using (true);

create policy "authenticated_select_snapshots" on keyword_snapshots
  for select to authenticated using (true);

create policy "authenticated_select_keywords" on keywords
  for select to authenticated using (true);

create policy "authenticated_insert_keywords" on keywords
  for insert to authenticated with check (true);

create policy "authenticated_update_keywords" on keywords
  for update to authenticated using (true);

create policy "authenticated_delete_keywords" on keywords
  for delete to authenticated using (true);

-- Not: GitHub Actions script'i service_role key kullanacak, o RLS'i otomatik
-- atlar (bypass), yani yukarıdaki kurallar sadece giriş yapmış frontend
-- kullanıcıları içindir.

-- Başlangıç kelimeleri (istersen değiştir/sil)
insert into keywords (keyword) values
  ('web sitesi tasarımı'),
  ('web sitesi tasarımı fiyatları'),
  ('seo uyumlu web sitesi');