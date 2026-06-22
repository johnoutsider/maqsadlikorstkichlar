-- ============================================================================
-- Bulk researcher registry (no authentication accounts).
-- Excel imports are split into doctoral/stajyor and independent researchers.
-- ============================================================================

create table if not exists public.izlanuvchilar (
  id               uuid primary key default gen_random_uuid(),
  university_id    uuid not null references public.universities(id) on delete cascade,
  turi             text not null check (turi in ('doktorant', 'mustaqil')),

  source_no        text,
  full_name        text not null,
  specialty_name   text,
  specialty_code   text,
  education_stage  text,
  admission_year   text,
  age              int check (age is null or age between 0 and 120),
  gender           text check (gender is null or gender in ('erkak', 'ayol')),
  pinfl            text,
  submission_date  date,
  course           text,
  monitoring_1     text,
  monitoring_2     text,
  monitoring_3     text,
  district         text,
  research_topic   text,
  supervisor_name  text,
  status           text,

  talim_tili       text,
  chorak           text,
  phone            text,
  himoya_holati    text,
  metadata         jsonb not null default '{}'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists izlanuvchilar_pinfl_key
  on public.izlanuvchilar (university_id, pinfl)
  where pinfl is not null and pinfl <> '';

create unique index if not exists izlanuvchilar_namespec_key
  on public.izlanuvchilar (
    university_id,
    lower(full_name),
    lower(coalesce(specialty_code, ''))
  )
  where pinfl is null or pinfl = '';

create index if not exists izlanuvchilar_university_turi_idx
  on public.izlanuvchilar (university_id, turi);

drop trigger if exists izlanuvchilar_updated_at on public.izlanuvchilar;
create trigger izlanuvchilar_updated_at
  before update on public.izlanuvchilar
  for each row execute function public.set_updated_at();

alter table public.izlanuvchilar enable row level security;

drop policy if exists izlanuvchilar_select on public.izlanuvchilar;
create policy izlanuvchilar_select
  on public.izlanuvchilar for select
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in (
        'university_admin',
        'vice_rector',
        'science_department'
      )
    )
  );

drop policy if exists izlanuvchilar_insert on public.izlanuvchilar;
create policy izlanuvchilar_insert
  on public.izlanuvchilar for insert
  to authenticated
  with check (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin', 'science_department')
    )
  );

drop policy if exists izlanuvchilar_update on public.izlanuvchilar;
create policy izlanuvchilar_update
  on public.izlanuvchilar for update
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin', 'science_department')
    )
  )
  with check (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin', 'science_department')
    )
  );

drop policy if exists izlanuvchilar_delete on public.izlanuvchilar;
create policy izlanuvchilar_delete
  on public.izlanuvchilar for delete
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin', 'science_department')
    )
  );
