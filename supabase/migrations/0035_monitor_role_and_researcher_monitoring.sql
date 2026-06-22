-- ============================================================================
-- Researcher monitoring: monitor role, department linkage, and score records.
-- ============================================================================

insert into public.roles (name, description, scope)
values (
  'monitor',
  'Nazoratchi - doktorant va mustaqil izlanuvchilar monitoringini baholaydi',
  'university'
)
on conflict (name) do nothing;

alter table public.izlanuvchilar
  add column if not exists department_id uuid
  references public.departments(id) on delete set null;

create index if not exists izlanuvchilar_department_idx
  on public.izlanuvchilar (department_id);

create table if not exists public.monitoring_evaluations (
  id                  uuid primary key default gen_random_uuid(),
  university_id       uuid not null references public.universities(id) on delete cascade,
  researcher_source   text not null check (researcher_source in ('doktorantlar', 'izlanuvchilar')),
  doktorant_id         uuid references public.doktorantlar(id) on delete restrict,
  izlanuvchi_id        uuid references public.izlanuvchilar(id) on delete restrict,
  department_id        uuid references public.departments(id) on delete set null,
  full_name            text not null,
  education_level      text,
  specialty_code       text,
  research_topic       text,
  advisor_name         text,
  monitoring_period    text not null,
  raw_score            int not null default 0 check (raw_score >= 0),
  scored_item_count    int not null default 0 check (scored_item_count >= 0),
  average_score        numeric(4,1) not null default 0 check (average_score between 0 and 5),
  total_score          int not null default 0 check (total_score between 0 and 100),
  created_by           uuid not null references public.users(id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint monitoring_evaluations_source_record_check check (
    (researcher_source = 'doktorantlar' and doktorant_id is not null and izlanuvchi_id is null)
    or
    (researcher_source = 'izlanuvchilar' and izlanuvchi_id is not null and doktorant_id is null)
  )
);

create table if not exists public.monitoring_evaluation_items (
  id                uuid primary key default gen_random_uuid(),
  evaluation_id     uuid not null references public.monitoring_evaluations(id) on delete cascade,
  section_no        int not null,
  section_title     text not null,
  criterion_key     text not null,
  indicator_label   text not null,
  max_score         int not null default 5 check (max_score > 0),
  score             int check (score is null or (score >= 0 and score <= max_score)),
  comment           text,
  disabled          boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (evaluation_id, criterion_key)
);

create index if not exists monitoring_evaluations_university_period_idx
  on public.monitoring_evaluations (university_id, monitoring_period, created_at desc);

create index if not exists monitoring_evaluations_department_idx
  on public.monitoring_evaluations (department_id);

create index if not exists monitoring_evaluation_items_evaluation_idx
  on public.monitoring_evaluation_items (evaluation_id);

drop trigger if exists monitoring_evaluations_updated_at
  on public.monitoring_evaluations;
create trigger monitoring_evaluations_updated_at
  before update on public.monitoring_evaluations
  for each row execute function public.set_updated_at();

alter table public.monitoring_evaluations enable row level security;
alter table public.monitoring_evaluation_items enable row level security;

-- Monitor users can read the two researcher sources within their university.
drop policy if exists izlanuvchilar_monitor_select on public.izlanuvchilar;
create policy izlanuvchilar_monitor_select
  on public.izlanuvchilar for select
  to authenticated
  using (
    current_user_role_name() = 'monitor'
    and university_id = current_user_university_id()
  );

drop policy if exists izlanuvchilar_monitor_insert on public.izlanuvchilar;
create policy izlanuvchilar_monitor_insert
  on public.izlanuvchilar for insert
  to authenticated
  with check (
    current_user_role_name() = 'monitor'
    and university_id = current_user_university_id()
  );

drop policy if exists izlanuvchilar_monitor_update on public.izlanuvchilar;
create policy izlanuvchilar_monitor_update
  on public.izlanuvchilar for update
  to authenticated
  using (
    current_user_role_name() = 'monitor'
    and university_id = current_user_university_id()
  )
  with check (
    current_user_role_name() = 'monitor'
    and university_id = current_user_university_id()
  );

drop policy if exists doktorantlar_monitor_select on public.doktorantlar;
create policy doktorantlar_monitor_select
  on public.doktorantlar for select
  to authenticated
  using (
    current_user_role_name() = 'monitor'
    and university_id = current_user_university_id()
  );

drop policy if exists supervisors_monitor_select on public.supervisors;
create policy supervisors_monitor_select
  on public.supervisors for select
  to authenticated
  using (
    current_user_role_name() = 'monitor'
    and (
      university_id = current_user_university_id()
      or exists (
        select 1
        from public.doktorantlar doktorant
        where doktorant.supervisor_id = supervisors.id
          and doktorant.university_id = current_user_university_id()
      )
    )
  );

drop policy if exists monitoring_evaluations_select on public.monitoring_evaluations;
create policy monitoring_evaluations_select
  on public.monitoring_evaluations for select
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in (
        'university_admin',
        'vice_rector',
        'science_department',
        'monitor'
      )
    )
  );

drop policy if exists monitoring_evaluations_insert on public.monitoring_evaluations;
create policy monitoring_evaluations_insert
  on public.monitoring_evaluations for insert
  to authenticated
  with check (
    university_id = current_user_university_id()
    and created_by = auth.uid()
    and current_user_role_name() in ('university_admin', 'science_department', 'monitor')
  );

drop policy if exists monitoring_evaluations_update on public.monitoring_evaluations;
create policy monitoring_evaluations_update
  on public.monitoring_evaluations for update
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and (
        current_user_role_name() in ('university_admin', 'science_department')
        or (current_user_role_name() = 'monitor' and created_by = auth.uid())
      )
    )
  )
  with check (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and (
        current_user_role_name() in ('university_admin', 'science_department')
        or (current_user_role_name() = 'monitor' and created_by = auth.uid())
      )
    )
  );

drop policy if exists monitoring_evaluations_delete on public.monitoring_evaluations;
create policy monitoring_evaluations_delete
  on public.monitoring_evaluations for delete
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and (
        current_user_role_name() in ('university_admin', 'science_department')
        or (current_user_role_name() = 'monitor' and created_by = auth.uid())
      )
    )
  );

drop policy if exists monitoring_evaluation_items_select
  on public.monitoring_evaluation_items;
create policy monitoring_evaluation_items_select
  on public.monitoring_evaluation_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_items.evaluation_id
        and (
          is_super_admin()
          or (
            evaluation.university_id = current_user_university_id()
            and current_user_role_name() in (
              'university_admin',
              'vice_rector',
              'science_department',
              'monitor'
            )
          )
        )
    )
  );

drop policy if exists monitoring_evaluation_items_insert
  on public.monitoring_evaluation_items;
create policy monitoring_evaluation_items_insert
  on public.monitoring_evaluation_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_items.evaluation_id
        and evaluation.university_id = current_user_university_id()
        and (
          current_user_role_name() in ('university_admin', 'science_department')
          or (current_user_role_name() = 'monitor' and evaluation.created_by = auth.uid())
        )
    )
  );

drop policy if exists monitoring_evaluation_items_update
  on public.monitoring_evaluation_items;
create policy monitoring_evaluation_items_update
  on public.monitoring_evaluation_items for update
  to authenticated
  using (
    exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_items.evaluation_id
        and (
          is_super_admin()
          or (
            evaluation.university_id = current_user_university_id()
            and (
              current_user_role_name() in ('university_admin', 'science_department')
              or (current_user_role_name() = 'monitor' and evaluation.created_by = auth.uid())
            )
          )
        )
    )
  );

drop policy if exists monitoring_evaluation_items_delete
  on public.monitoring_evaluation_items;
create policy monitoring_evaluation_items_delete
  on public.monitoring_evaluation_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_items.evaluation_id
        and (
          is_super_admin()
          or (
            evaluation.university_id = current_user_university_id()
            and (
              current_user_role_name() in ('university_admin', 'science_department')
              or (current_user_role_name() = 'monitor' and evaluation.created_by = auth.uid())
            )
          )
        )
    )
  );
