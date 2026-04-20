-- ============================================================================
-- Initial schema: multi-tenant university KPI tracking
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Idempotent-ish: drops/creates types and tables in correct order.
-- ============================================================================

-- Required extensions
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type quarter as enum ('Q1', 'Q2', 'Q3', 'Q4');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('draft', 'pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type role_scope as enum ('global', 'university', 'faculty', 'department');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Universities (tenants)
-- ----------------------------------------------------------------------------
create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null unique,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Roles (extensible — add new rows to introduce roles without schema changes)
-- ----------------------------------------------------------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  scope role_scope not null,
  created_at timestamptz not null default now()
);

insert into roles (name, description, scope) values
  ('super_admin',        'Cross-tenant administrator (sees all universities)', 'global'),
  ('university_admin',   'Owner of one university — manages users, faculties, departments, indicators', 'university'),
  ('vice_rector',        'Read-only oversight across one university', 'university'),
  ('science_department', 'Sets targets, reviews and approves/rejects submissions', 'university'),
  ('dean',               'Owns the KPI of one faculty', 'faculty'),
  ('staff_manager',      'Submits forms for one department', 'department')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Faculties
-- ----------------------------------------------------------------------------
create table if not exists faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  name text not null,
  short_code text not null,
  dean_user_id uuid,  -- FK added below after users table
  created_at timestamptz not null default now(),
  unique (university_id, short_code)
);

-- ----------------------------------------------------------------------------
-- Departments
-- ----------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  name text not null,
  short_code text not null,
  created_at timestamptz not null default now(),
  unique (faculty_id, short_code)
);

-- ----------------------------------------------------------------------------
-- Users (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  university_id uuid references universities(id) on delete set null,  -- null only for super_admin
  role_id uuid not null references roles(id),
  faculty_id uuid references faculties(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  display_name text not null,
  email text not null unique,
  must_change_password boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Now wire faculties.dean_user_id → users.id
do $$ begin
  alter table faculties
    add constraint faculties_dean_user_id_fkey
    foreign key (dean_user_id) references users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Indicators (per-university KPI definitions)
-- ----------------------------------------------------------------------------
create table if not exists indicators (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  no text not null,
  name text not null,
  unit text not null,
  order_idx int not null,
  is_sub_indicator boolean not null default false,
  created_at timestamptz not null default now(),
  unique (university_id, no)
);

-- ----------------------------------------------------------------------------
-- Targets (faculty-level KPI — owned by the dean)
-- ----------------------------------------------------------------------------
create table if not exists targets (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  year int not null,
  quarter quarter not null,
  values jsonb not null default '{}'::jsonb,  -- { indicator_id: number }
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (faculty_id, year, quarter)
);

-- ----------------------------------------------------------------------------
-- Submissions (department-level — filled by staff_manager)
-- ----------------------------------------------------------------------------
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  year int not null,
  quarter quarter not null,
  status submission_status not null default 'draft',
  submitted_by uuid not null references users(id),
  submitted_at timestamptz,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  review_comment text,
  indicators jsonb not null default '{}'::jsonb,  -- { indicator_id: { value, files: [path] } }
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (department_id, year, quarter)
);

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_users_university on users (university_id);
create index if not exists idx_users_role on users (role_id);
create index if not exists idx_faculties_university on faculties (university_id);
create index if not exists idx_departments_university on departments (university_id);
create index if not exists idx_departments_faculty on departments (faculty_id);
create index if not exists idx_targets_lookup on targets (university_id, year, quarter);
create index if not exists idx_submissions_lookup on submissions (university_id, year, quarter, status);
create index if not exists idx_submissions_department on submissions (department_id);
create index if not exists idx_notifications_recipient on notifications (recipient_id, read);

-- ----------------------------------------------------------------------------
-- Helper functions for RLS (security definer to bypass RLS when reading own row)
-- ----------------------------------------------------------------------------
create or replace function current_user_role_name() returns text
  language sql stable security definer set search_path = public as $$
  select r.name from public.users u join public.roles r on r.id = u.role_id where u.id = auth.uid()
$$;

create or replace function current_user_university_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select university_id from public.users where id = auth.uid()
$$;

create or replace function current_user_faculty_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select faculty_id from public.users where id = auth.uid()
$$;

create or replace function current_user_department_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select department_id from public.users where id = auth.uid()
$$;

create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role_name() = 'super_admin', false)
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------
alter table universities  enable row level security;
alter table roles         enable row level security;
alter table users         enable row level security;
alter table faculties     enable row level security;
alter table departments   enable row level security;
alter table indicators    enable row level security;
alter table targets       enable row level security;
alter table submissions   enable row level security;
alter table notifications enable row level security;

-- ----------------------------------------------------------------------------
-- Policies — ROLES (everyone authenticated can read)
-- ----------------------------------------------------------------------------
drop policy if exists roles_select on roles;
create policy roles_select on roles for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Policies — UNIVERSITIES
-- ----------------------------------------------------------------------------
drop policy if exists universities_select on universities;
create policy universities_select on universities for select to authenticated
  using (is_super_admin() or id = current_user_university_id());

drop policy if exists universities_write on universities;
create policy universities_write on universities for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Policies — USERS
-- ----------------------------------------------------------------------------
drop policy if exists users_select on users;
create policy users_select on users for select to authenticated using (
  is_super_admin()
  or id = auth.uid()
  or (university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin','vice_rector','science_department','dean'))
);

drop policy if exists users_insert on users;
create policy users_insert on users for insert to authenticated with check (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
);

drop policy if exists users_update on users;
create policy users_update on users for update to authenticated using (
  is_super_admin()
  or id = auth.uid()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
);

drop policy if exists users_delete on users;
create policy users_delete on users for delete to authenticated using (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
);

-- ----------------------------------------------------------------------------
-- Policies — FACULTIES
-- ----------------------------------------------------------------------------
drop policy if exists faculties_select on faculties;
create policy faculties_select on faculties for select to authenticated using (
  is_super_admin() or university_id = current_user_university_id()
);

drop policy if exists faculties_write on faculties;
create policy faculties_write on faculties for all to authenticated using (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
) with check (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
);

-- ----------------------------------------------------------------------------
-- Policies — DEPARTMENTS
-- ----------------------------------------------------------------------------
drop policy if exists departments_select on departments;
create policy departments_select on departments for select to authenticated using (
  is_super_admin() or university_id = current_user_university_id()
);

drop policy if exists departments_write on departments;
create policy departments_write on departments for all to authenticated using (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
) with check (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
);

-- ----------------------------------------------------------------------------
-- Policies — INDICATORS
-- ----------------------------------------------------------------------------
drop policy if exists indicators_select on indicators;
create policy indicators_select on indicators for select to authenticated using (
  is_super_admin() or university_id = current_user_university_id()
);

drop policy if exists indicators_write on indicators;
create policy indicators_write on indicators for all to authenticated using (
  is_super_admin()
  or (current_user_role_name() in ('university_admin','science_department')
      and university_id = current_user_university_id())
) with check (
  is_super_admin()
  or (current_user_role_name() in ('university_admin','science_department')
      and university_id = current_user_university_id())
);

-- ----------------------------------------------------------------------------
-- Policies — TARGETS (set by science_department; viewable by uni members)
-- ----------------------------------------------------------------------------
drop policy if exists targets_select on targets;
create policy targets_select on targets for select to authenticated using (
  is_super_admin() or university_id = current_user_university_id()
);

drop policy if exists targets_write on targets;
create policy targets_write on targets for all to authenticated using (
  is_super_admin()
  or (current_user_role_name() in ('university_admin','science_department')
      and university_id = current_user_university_id())
) with check (
  is_super_admin()
  or (current_user_role_name() in ('university_admin','science_department')
      and university_id = current_user_university_id())
);

-- ----------------------------------------------------------------------------
-- Policies — SUBMISSIONS
--   staff_manager: full CRUD on own department's submission
--   science_department: SELECT all in uni + UPDATE (review/approve)
--   vice_rector + dean + university_admin: SELECT
-- ----------------------------------------------------------------------------
drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions for select to authenticated using (
  is_super_admin()
  or (university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin','vice_rector','science_department'))
  or (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id())
  or (current_user_role_name() = 'staff_manager' and department_id = current_user_department_id())
);

drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions for insert to authenticated with check (
  current_user_role_name() = 'staff_manager'
  and department_id = current_user_department_id()
  and university_id = current_user_university_id()
);

drop policy if exists submissions_update on submissions;
create policy submissions_update on submissions for update to authenticated using (
  is_super_admin()
  or (current_user_role_name() = 'staff_manager' and department_id = current_user_department_id())
  or (current_user_role_name() in ('university_admin','science_department')
      and university_id = current_user_university_id())
);

drop policy if exists submissions_delete on submissions;
create policy submissions_delete on submissions for delete to authenticated using (
  is_super_admin()
  or (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
);

-- ----------------------------------------------------------------------------
-- Policies — NOTIFICATIONS (own only)
-- ----------------------------------------------------------------------------
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated
  using (recipient_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Storage bucket: submissions
--   Path convention: {university_id}/{year}/{quarter}/{department_id}/{filename}
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- Drop old policies (in case of rerun)
drop policy if exists submissions_storage_select on storage.objects;
drop policy if exists submissions_storage_insert on storage.objects;
drop policy if exists submissions_storage_update on storage.objects;
drop policy if exists submissions_storage_delete on storage.objects;

-- Read: super_admin OR same university (path[1] is university_id)
create policy submissions_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'submissions' and (
    is_super_admin()
    or (storage.foldername(name))[1] = current_user_university_id()::text
  )
);

-- Write/update: staff_manager only, scoped to own university+department
create policy submissions_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'submissions'
  and current_user_role_name() = 'staff_manager'
  and (storage.foldername(name))[1] = current_user_university_id()::text
  and (storage.foldername(name))[4] = current_user_department_id()::text
);

create policy submissions_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'submissions'
  and current_user_role_name() = 'staff_manager'
  and (storage.foldername(name))[1] = current_user_university_id()::text
  and (storage.foldername(name))[4] = current_user_department_id()::text
);

create policy submissions_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'submissions'
  and (
    is_super_admin()
    or (current_user_role_name() = 'staff_manager'
        and (storage.foldername(name))[1] = current_user_university_id()::text
        and (storage.foldername(name))[4] = current_user_department_id()::text)
  )
);
