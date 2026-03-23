-- ============================================================
-- CONSEJO DE BARRIO — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null,
  org_id text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read all profiles"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ── REPORTS ─────────────────────────────────────────────────
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  org_id text not null,
  created_by uuid references public.profiles(id) on delete cascade,
  created_by_name text not null,
  name text not null,
  council_date date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  data jsonb not null default '{
    "urgentes": [],
    "miembros": [],
    "datos_miembros": [],
    "preguntas_obispo": [],
    "actividades": [],
    "generales": []
  }'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reports enable row level security;

-- Bishopric can read all reports
create policy "Bishopric reads all reports"
  on public.reports for select
  using (
    auth.role() = 'authenticated' and (
      -- Own org can always read
      org_id = (select org_id from public.profiles where id = auth.uid()) or
      -- Bishopric reads everything
      (select role from public.profiles where id = auth.uid()) in
        ('obispo','c1_ob','c2_ob','sec_ej','sec_ba')
    )
  );

-- Only own org can insert/update (but only own draft, or bishopric)
create policy "Org can insert own reports"
  on public.reports for insert
  with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

create policy "Org can update own reports"
  on public.reports for update
  using (
    org_id = (select org_id from public.profiles where id = auth.uid()) or
    (select role from public.profiles where id = auth.uid()) in
      ('obispo','c1_ob','c2_ob','sec_ej','sec_ba')
  );

-- Trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_report_update
  before update on public.reports
  for each row execute procedure public.handle_updated_at();

-- ── EVENTS ──────────────────────────────────────────────────
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  event_date date not null,
  event_time time,
  responsible text,
  notes text,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.events enable row level security;

create policy "All authenticated can read events"
  on public.events for select using (auth.role() = 'authenticated');

create policy "All authenticated can insert events"
  on public.events for insert with check (auth.role() = 'authenticated');

create policy "All authenticated can update events"
  on public.events for update using (auth.role() = 'authenticated');

-- ── NOTIFICATIONS ───────────────────────────────────────────
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  member_item_id text not null,
  member_name text not null,
  mu_type text not null,
  type_label text not null,
  fields jsonb not null default '{}'::jsonb,
  reported_by text not null,
  reported_by_org text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Bishopric can read notifications"
  on public.notifications for select
  using (
    auth.role() = 'authenticated' and
    (select role from public.profiles where id = auth.uid()) in
      ('obispo','c1_ob','c2_ob','sec_ej','sec_ba')
  );

create policy "All authenticated can insert notifications"
  on public.notifications for insert with check (auth.role() = 'authenticated');

create policy "Bishopric can update notifications"
  on public.notifications for update
  using (
    (select role from public.profiles where id = auth.uid()) in
      ('obispo','c1_ob','c2_ob','sec_ej','sec_ba')
  );

-- ── REALTIME ────────────────────────────────────────────────
-- Enable realtime for reports and notifications
alter publication supabase_realtime add table public.reports;
alter publication supabase_realtime add table public.notifications;
