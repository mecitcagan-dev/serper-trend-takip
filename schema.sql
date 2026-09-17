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

-- Row Level Security açık (proje oluştururken "Enable automatic RLS" seçtiğin için
-- bu tablolar zaten varsayılan olarak kilitli geliyor olabilir - yine de garantiye alalım)
alter table keywords enable row level security;
alter table runs enable row level security;
alter table keyword_snapshots enable row level security;

-- Frontend (anon key ile tarayıcıdan) sadece OKUMA yapabilsin: runs ve snapshots
create policy "anon_select_runs" on runs
  for select to anon using (true);

create policy "anon_select_snapshots" on keyword_snapshots
  for select to anon using (true);

-- Frontend, kelime listesini okuyup DÜZENLEYEBİLSİN (Kelimeleri Düzenle butonu için)
create policy "anon_select_keywords" on keywords
  for select to anon using (true);

create policy "anon_insert_keywords" on keywords
  for insert to anon with check (true);

create policy "anon_update_keywords" on keywords
  for update to anon using (true);

create policy "anon_delete_keywords" on keywords
  for delete to anon using (true);

-- Not: GitHub Actions script'i service_role key kullanacak, o RLS'i otomatik
-- atlar (bypass), yani yukarıdaki kurallar sadece anon/frontend içindir.

-- Başlangıç kelimeleri (istersen değiştir/sil)
insert into keywords (keyword) values
  ('web sitesi tasarımı'),
  ('web sitesi tasarımı fiyatları'),
  ('seo uyumlu web sitesi');
