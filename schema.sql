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

-- service_role (scan.py, GitHub Actions) — RLS'i bypass etse de Postgres'in
-- GRANT sistemi ayrı bir katman; bu olmadan "permission denied" hatası alınır.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.keywords to service_role;
grant select, insert, update, delete on public.runs to service_role;
grant select, insert, update, delete on public.keyword_snapshots to service_role;

-- =============================================================
-- v7: Hedef domain sıra takibi
-- =============================================================

-- Proje hedefi varsayılan değerdir; bir kelime gerektiğinde kendi hedefini
-- (ör. farklı landing page veya alt domain) kullanabilir.
alter table keywords add column if not exists target_domain text;
create index if not exists idx_keywords_project_active
  on public.keywords(project_id, active);

-- =============================================================
-- v8: Arama pazarı ve cihaz ayarları
-- =============================================================

alter table projects add column if not exists country_code text not null default 'tr';
alter table projects add column if not exists language_code text not null default 'tr';
alter table projects add column if not exists location text;
alter table projects add column if not exists device text not null default 'desktop';

-- =============================================================
-- v9: Google Search Console proje mülkü
-- =============================================================

-- OAuth access token tutulmaz; yalnızca kullanıcının seçtiği mülk adresi
-- proje bağlamında saklanır. Token tarayıcı oturumu içinde geçici kalır.
alter table projects add column if not exists gsc_site_url text;

-- =============================================================
-- v10: Ücretsiz GEO/AI görünürlük kanıt kayıtları
-- =============================================================

-- Ücretli bir AI API'sine otomatik istek atılmaz. Kullanıcı, ChatGPT/Gemini
-- gibi izinli bir arayüzde yaptığı kontrolün kanıtını buraya kaydeder.
create table if not exists geo_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id bigint not null references public.projects(id) on delete cascade,
  prompt text not null,
  source text not null default 'manual',
  answer_excerpt text not null default '',
  brand_mentioned boolean not null default false,
  competitor_mentions text not null default '',
  cited_domains text not null default '',
  notes text not null default '',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table geo_checks enable row level security;
drop policy if exists "users_own_geo_checks_select" on geo_checks;
drop policy if exists "users_own_geo_checks_insert" on geo_checks;
drop policy if exists "users_own_geo_checks_update" on geo_checks;
drop policy if exists "users_own_geo_checks_delete" on geo_checks;

create policy "users_own_geo_checks_select" on geo_checks
  for select to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = geo_checks.project_id and p.user_id = auth.uid()
    )
  );
create policy "users_own_geo_checks_insert" on geo_checks
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = geo_checks.project_id and p.user_id = auth.uid()
    )
  );
create policy "users_own_geo_checks_update" on geo_checks
  for update to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = geo_checks.project_id and p.user_id = auth.uid()
    )
  ) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = geo_checks.project_id and p.user_id = auth.uid()
    )
  );
create policy "users_own_geo_checks_delete" on geo_checks
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = geo_checks.project_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.geo_checks to authenticated;
grant select, insert, update, delete on public.geo_checks to service_role;
grant usage on all sequences in schema public to service_role;
create index if not exists idx_geo_checks_project_checked_at
  on public.geo_checks(project_id, checked_at desc);
grant select, insert, update, delete on public.settings to service_role;
grant usage on all sequences in schema public to service_role;

-- Not: GitHub Actions script'i (scan.py) service_role key kullanır,
-- bu RLS'i otomatik bypass eder (bypassrls). Yukarıdaki kurallar sadece
-- giriş yapmış frontend kullanıcıları içindir — her kullanıcı sadece
-- kendi user_id'siyle eşleşen satırları görür/değiştirir.

-- =============================================================
-- v3: Ortak/paylaşımlı deneme Serper key'i — kişi başı 10 tarama hakkı
-- =============================================================

-- Kendi key'ini girmemiş kullanıcılar için, scan.py'nin kaç kez ortak
-- deneme key'ini kullandığını sayar. Varsayılan limit (10) scan.py ve
-- app.js içinde SHARED_KEY_LIMIT olarak tanımlı.
alter table profiles add column if not exists shared_key_scans_used int not null default 0;

-- Bu sayaç SADECE scan.py'nin kullandığı service_role tarafından
-- artırılmalı. "user_own_profile_update" politikası kullanıcının kendi
-- satırını güncellemesine izin verdiğinden (kolon bazlı kısıtlama RLS'te
-- doğrudan mümkün olmadığından), bir trigger ile service_role dışındaki
-- her güncellemede bu kolonu eski değerine sabitliyoruz — yani kullanıcı
-- tarayıcıdan bu sayacı sıfırlayıp hakkını yenileyemez.
create or replace function protect_shared_key_scans_used()
returns trigger as $$
begin
  if auth.role() <> 'service_role'
     and new.shared_key_scans_used is distinct from old.shared_key_scans_used then
    new.shared_key_scans_used := old.shared_key_scans_used;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_shared_key_scans_used on profiles;
create trigger trg_protect_shared_key_scans_used
  before update on profiles
  for each row execute function protect_shared_key_scans_used();

-- =============================================================
-- v4: Kullanıcı kaydında otomatik profil oluşturma
--     (progress-tracker.md — Şu Anki Hedef / İş 1)
-- =============================================================

-- profiles tablosuna email kolonu eklenir. auth.users şemasına scan.py'nin
-- (service_role ile de olsa) doğrudan postgrest erişimi olmadığından, email
-- burada denormalize tutulur (İş 5 — email bildirimi — için de gerekli).
alter table profiles add column if not exists email text;

-- auth.users'a her yeni kayıtta (email/şifre veya Google OAuth fark etmeksizin)
-- otomatik olarak bir profiles satırı açar. settingsModal.js'teki mevcut
-- upsert akışı DEĞİŞMEDİ — sadece artık kullanıcı Ayarlar'ı hiç açmasa bile
-- profiles satırı zaten var olacak, bu yüzden scan.py'nin get_all_profiles()
-- taraması onu atlamayacak.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tek seferlik backfill: trigger eklenmeden ÖNCE kayıt olmuş, henüz
-- profiles satırı olmayan kullanıcılar için (bu migration'ın asıl amacı —
-- "ikinci kullanıcıya tarama sonucu gelmiyor" sorununun kök nedeni).
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- =============================================================
-- v5: runs tablosu için Realtime aboneliği
--     (progress-tracker.md — Şu Anki Hedef / İş 2 / Plan Maddesi 2a)
-- =============================================================

-- feed.js'in F5 atmadan otomatik güncellenebilmesi için: giriş yapan
-- kullanıcının runs tablosuna yeni bir satır INSERT edildiğinde
-- Supabase Realtime bunu istemciye postgres_changes olarak yayınlar.
-- Yeni bağımlılık yok — Realtime, zaten kullanılan @supabase/supabase-js
-- CDN paketinin içinde geliyor.
--
-- IF NOT EXISTS burada yok çünkü ALTER PUBLICATION ... ADD TABLE bunu
-- desteklemiyor; tablo zaten publication'daysa bu satır hata verir, bu
-- yüzden önce var olup olmadığını kontrol edip yoksa ekleyen bir DO bloğu
-- kullanıyoruz (script'in tekrar tekrar çalıştırılabilir kalması için).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'runs'
  ) then
    alter publication supabase_realtime add table public.runs;
  end if;
end $$;

-- =============================================================
-- v6: Vayes için müşteri/proje ayrımı
-- =============================================================

-- Bir kullanıcı birden fazla müşteri/proje yönetebilir. Bu tablo yalnızca
-- proje sahipliğini tutar; tüm müşteri verileri yine user_id ile izole edilir.
create table if not exists projects (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_name text not null default '',
  target_domain text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table projects enable row level security;

drop policy if exists "users_own_projects_select" on projects;
drop policy if exists "users_own_projects_insert" on projects;
drop policy if exists "users_own_projects_update" on projects;
drop policy if exists "users_own_projects_delete" on projects;

create policy "users_own_projects_select" on projects
  for select to authenticated using (user_id = auth.uid());
create policy "users_own_projects_insert" on projects
  for insert to authenticated with check (user_id = auth.uid());
create policy "users_own_projects_update" on projects
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "users_own_projects_delete" on projects
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.projects to service_role;
grant usage on all sequences in schema public to service_role;

-- Eski kullanıcıların verileri için birer varsayılan proje oluşturulur.
insert into public.projects (user_id, name, client_name)
select p.id, 'Genel Proje', coalesce(p.email, '')
from public.profiles p
where not exists (
  select 1 from public.projects existing where existing.user_id = p.id
);

-- Yeni veri modeline geçiş için mevcut tablolara proje bağlantısı eklenir.
alter table keywords add column if not exists project_id bigint references public.projects(id) on delete cascade;
alter table runs add column if not exists project_id bigint references public.projects(id) on delete cascade;
alter table keyword_snapshots add column if not exists project_id bigint references public.projects(id) on delete cascade;

-- Eski satırlar kullanıcının ilk projesine taşınır.
update public.keywords k
set project_id = p.id
from public.projects p
where k.project_id is null
  and p.user_id = k.user_id
  and p.id = (
    select min(first_project.id)
    from public.projects first_project
    where first_project.user_id = k.user_id
  );

update public.runs r
set project_id = p.id
from public.projects p
where r.project_id is null
  and p.user_id = r.user_id
  and p.id = (
    select min(first_project.id)
    from public.projects first_project
    where first_project.user_id = r.user_id
  );

update public.keyword_snapshots s
set project_id = p.id
from public.projects p
where s.project_id is null
  and p.user_id = s.user_id
  and p.id = (
    select min(first_project.id)
    from public.projects first_project
    where first_project.user_id = s.user_id
  );

-- RLS artık hem kullanıcı hem proje sahipliğini doğrular.
drop policy if exists "user_select_keywords" on keywords;
drop policy if exists "user_insert_keywords" on keywords;
drop policy if exists "user_update_keywords" on keywords;
drop policy if exists "user_delete_keywords" on keywords;

create policy "user_select_keywords" on keywords
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = keywords.project_id and p.user_id = auth.uid()
    )
  );
create policy "user_insert_keywords" on keywords
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = keywords.project_id and p.user_id = auth.uid()
    )
  );
create policy "user_update_keywords" on keywords
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = keywords.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = keywords.project_id and p.user_id = auth.uid()
    )
  );
create policy "user_delete_keywords" on keywords
  for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = keywords.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "user_select_runs" on runs;
create policy "user_select_runs" on runs
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = runs.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "user_select_snapshots" on keyword_snapshots;
create policy "user_select_snapshots" on keyword_snapshots
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = keyword_snapshots.project_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.keywords to service_role;
grant select, insert, update, delete on public.runs to service_role;
grant select, insert, update, delete on public.keyword_snapshots to service_role;
