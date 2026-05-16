-- ============================================================================
-- O'quv jarayoni: Fanlar, Guruhlar, Fan yuklamasi, Shaxsiy ish reja
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type education_type as enum ('bakalavr', 'magistr');
exception when duplicate_object then null; end $$;

do $$ begin
  create type group_type as enum ('amaliy', 'seminar', 'maruza');
exception when duplicate_object then null; end $$;

do $$ begin
  create type semester as enum ('kuzgi', 'bahorgi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_type as enum (
    'maruza', 'seminar', 'amaliy', 'reyting', 'malaka_amaliyoti',
    'bmi_rahbarlik', 'yada', 'md_rahbarlik', 'mustaqil_tadqiqot',
    'doktorantura', 'kurs_ishi'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_plan_status as enum ('draft', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Academic Years
-- ----------------------------------------------------------------------------
create table if not exists academic_years (
  id            uuid        primary key default gen_random_uuid(),
  university_id uuid        not null references universities(id) on delete cascade,
  name          text        not null,             -- e.g. "2024-2025"
  start_date    date        not null,
  end_date      date        not null,
  is_active     boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- Only one active academic year per university
create unique index if not exists academic_years_one_active_per_uni
  on academic_years (university_id)
  where is_active = true;

alter table academic_years enable row level security;

-- All authenticated users in same university can read
create policy "university members read academic_years"
  on academic_years for select
  to authenticated
  using (
    is_super_admin()
    or university_id = current_user_university_id()
  );

-- university_admin can manage academic years
create policy "university_admin manages academic_years"
  on academic_years for all
  to authenticated
  using  (current_user_role_name() = 'university_admin' and university_id = current_user_university_id())
  with check (current_user_role_name() = 'university_admin' and university_id = current_user_university_id());

-- super_admin full access
create policy "super_admin full academic_years"
  on academic_years for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Subjects (Fanlar) — owned by dean, per faculty/department
-- ----------------------------------------------------------------------------
create table if not exists subjects (
  id              uuid          primary key default gen_random_uuid(),
  university_id   uuid          not null references universities(id) on delete cascade,
  faculty_id      uuid          not null references faculties(id)    on delete cascade,
  department_id   uuid          not null references departments(id)  on delete cascade,
  academic_year_id uuid         not null references academic_years(id) on delete cascade,
  name            text          not null,
  course          smallint      not null check (course between 1 and 6),
  education_type  education_type not null,
  created_by      uuid          references users(id) on delete set null,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists idx_subjects_faculty      on subjects (faculty_id);
create index if not exists idx_subjects_department   on subjects (department_id);
create index if not exists idx_subjects_academic_year on subjects (academic_year_id);

do $$ begin
  create trigger subjects_updated_at
    before update on subjects
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

alter table subjects enable row level security;

-- All authenticated users in same university can read subjects
create policy "university members read subjects"
  on subjects for select
  to authenticated
  using (
    is_super_admin()
    or university_id = current_user_university_id()
  );

-- Dean can manage subjects in their faculty
create policy "dean manages faculty subjects"
  on subjects for all
  to authenticated
  using  (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id())
  with check (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id());

-- super_admin full access
create policy "super_admin full subjects"
  on subjects for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Study Groups (Guruhlar)
-- ----------------------------------------------------------------------------
create table if not exists study_groups (
  id               uuid          primary key default gen_random_uuid(),
  university_id    uuid          not null references universities(id) on delete cascade,
  faculty_id       uuid          not null references faculties(id)    on delete cascade,
  academic_year_id uuid          not null references academic_years(id) on delete cascade,
  name             text          not null,
  course           smallint      not null check (course between 1 and 6),
  education_type   education_type not null,
  group_type       group_type    not null,
  student_count    int           not null default 0 check (student_count >= 0),
  created_by       uuid          references users(id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists idx_study_groups_faculty       on study_groups (faculty_id);
create index if not exists idx_study_groups_academic_year on study_groups (academic_year_id);
create index if not exists idx_study_groups_type          on study_groups (faculty_id, group_type);

do $$ begin
  create trigger study_groups_updated_at
    before update on study_groups
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

alter table study_groups enable row level security;

create policy "university members read study_groups"
  on study_groups for select
  to authenticated
  using (
    is_super_admin()
    or university_id = current_user_university_id()
  );

create policy "dean manages faculty study_groups"
  on study_groups for all
  to authenticated
  using  (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id())
  with check (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id());

create policy "super_admin full study_groups"
  on study_groups for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Study Group Members (junction: amaliy guruh → seminar/maruza guruh)
-- parent = seminar/maruza, child = amaliy
-- ----------------------------------------------------------------------------
create table if not exists study_group_members (
  parent_group_id uuid not null references study_groups(id) on delete cascade,
  child_group_id  uuid not null references study_groups(id) on delete cascade,
  primary key (parent_group_id, child_group_id),
  check (parent_group_id <> child_group_id)
);

create index if not exists idx_sgm_child on study_group_members (child_group_id);

alter table study_group_members enable row level security;

create policy "university members read study_group_members"
  on study_group_members for select
  to authenticated
  using (
    is_super_admin()
    or exists (
      select 1 from study_groups g
      where g.id = parent_group_id
        and g.university_id = current_user_university_id()
    )
  );

create policy "dean manages study_group_members"
  on study_group_members for all
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from study_groups g
      where g.id = parent_group_id
        and g.faculty_id = current_user_faculty_id()
    )
  )
  with check (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from study_groups g
      where g.id = parent_group_id
        and g.faculty_id = current_user_faculty_id()
    )
  );

create policy "super_admin full study_group_members"
  on study_group_members for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Subject Workloads (Fan yuklamasi) — hours budget per subject per semester
-- ----------------------------------------------------------------------------
create table if not exists subject_workloads (
  id                      uuid        primary key default gen_random_uuid(),
  subject_id              uuid        not null references subjects(id) on delete cascade,
  semester                semester    not null,
  maruza_h                numeric(8,2) not null default 0,
  seminar_h               numeric(8,2) not null default 0,
  amaliy_h                numeric(8,2) not null default 0,
  reyting_h               numeric(8,2) not null default 0,
  malaka_amaliyoti_h      numeric(8,2) not null default 0,
  bmi_rahbarlik_h         numeric(8,2) not null default 0,
  yada_h                  numeric(8,2) not null default 0,
  md_rahbarlik_h          numeric(8,2) not null default 0,
  mustaqil_tadqiqot_h     numeric(8,2) not null default 0,
  doktorantura_h          numeric(8,2) not null default 0,
  kurs_ishi_h             numeric(8,2) not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (subject_id, semester)
);

do $$ begin
  create trigger subject_workloads_updated_at
    before update on subject_workloads
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

alter table subject_workloads enable row level security;

create policy "university members read subject_workloads"
  on subject_workloads for select
  to authenticated
  using (
    is_super_admin()
    or exists (
      select 1 from subjects s
      where s.id = subject_id
        and s.university_id = current_user_university_id()
    )
  );

create policy "dean manages subject_workloads"
  on subject_workloads for all
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from subjects s
      where s.id = subject_id
        and s.faculty_id = current_user_faculty_id()
    )
  )
  with check (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from subjects s
      where s.id = subject_id
        and s.faculty_id = current_user_faculty_id()
    )
  );

create policy "super_admin full subject_workloads"
  on subject_workloads for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Teacher Work Plans (Shaxsiy ish reja) — one per teacher per academic year
-- ----------------------------------------------------------------------------
create table if not exists teacher_work_plans (
  id               uuid             primary key default gen_random_uuid(),
  university_id    uuid             not null references universities(id) on delete cascade,
  teacher_id       uuid             not null references teachers(id)     on delete cascade,
  academic_year_id uuid             not null references academic_years(id) on delete cascade,
  position         text,            -- lavozim at plan creation time
  stavka           text,            -- stavka at plan creation time
  status           work_plan_status not null default 'draft',
  rejection_reason text,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid             references users(id) on delete set null,
  created_by       uuid             references users(id) on delete set null,
  created_at       timestamptz      not null default now(),
  updated_at       timestamptz      not null default now(),
  unique (teacher_id, academic_year_id)
);

create index if not exists idx_twp_university    on teacher_work_plans (university_id);
create index if not exists idx_twp_teacher       on teacher_work_plans (teacher_id);
create index if not exists idx_twp_academic_year on teacher_work_plans (academic_year_id);
create index if not exists idx_twp_status        on teacher_work_plans (status);

do $$ begin
  create trigger teacher_work_plans_updated_at
    before update on teacher_work_plans
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

alter table teacher_work_plans enable row level security;

-- staff_manager: full CRUD for their department's teachers (draft/rejected only for write)
create policy "staff_manager reads own dept plans"
  on teacher_work_plans for select
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.department_id = current_user_department_id()
    )
  );

create policy "staff_manager inserts own dept plans"
  on teacher_work_plans for insert
  to authenticated
  with check (
    current_user_role_name() = 'staff_manager'
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.department_id = current_user_department_id()
    )
  );

create policy "staff_manager updates draft/rejected plans"
  on teacher_work_plans for update
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and status in ('draft', 'rejected')
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.department_id = current_user_department_id()
    )
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.department_id = current_user_department_id()
    )
  );

-- dean: read submitted plans + update (approve/reject) submitted plans in faculty
create policy "dean reads faculty plans"
  on teacher_work_plans for select
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.faculty_id = current_user_faculty_id()
    )
  );

create policy "dean approves submitted plans"
  on teacher_work_plans for update
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and status = 'submitted'
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.faculty_id = current_user_faculty_id()
    )
  )
  with check (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from teachers t
      where t.id = teacher_id
        and t.faculty_id = current_user_faculty_id()
    )
  );

-- university_admin, vice_rector, science_department: read all in university
create policy "university roles read all plans"
  on teacher_work_plans for select
  to authenticated
  using (
    current_user_role_name() in ('university_admin', 'vice_rector', 'science_department')
    and university_id = current_user_university_id()
  );

-- super_admin full access
create policy "super_admin full teacher_work_plans"
  on teacher_work_plans for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Teacher Allocations (Yuklama qatorlari) — rows in a work plan
-- ----------------------------------------------------------------------------
create table if not exists teacher_allocations (
  id           uuid        primary key default gen_random_uuid(),
  work_plan_id uuid        not null references teacher_work_plans(id) on delete cascade,
  subject_id   uuid        not null references subjects(id) on delete restrict,
  group_id     uuid        references study_groups(id) on delete set null,
  semester     semester    not null,
  work_type    work_type   not null,
  hours        numeric(8,2) not null check (hours > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_ta_work_plan on teacher_allocations (work_plan_id);
create index if not exists idx_ta_subject   on teacher_allocations (subject_id);

do $$ begin
  create trigger teacher_allocations_updated_at
    before update on teacher_allocations
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

alter table teacher_allocations enable row level security;

-- staff_manager: manage allocations for plans they own (draft/rejected only)
create policy "staff_manager manages own allocations"
  on teacher_allocations for all
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and exists (
      select 1 from teacher_work_plans p
      join teachers t on t.id = p.teacher_id
      where p.id = work_plan_id
        and p.status in ('draft', 'rejected')
        and t.department_id = current_user_department_id()
    )
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and exists (
      select 1 from teacher_work_plans p
      join teachers t on t.id = p.teacher_id
      where p.id = work_plan_id
        and p.status in ('draft', 'rejected')
        and t.department_id = current_user_department_id()
    )
  );

-- dean: read allocations for plans in their faculty
create policy "dean reads faculty allocations"
  on teacher_allocations for select
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and exists (
      select 1 from teacher_work_plans p
      join teachers t on t.id = p.teacher_id
      where p.id = work_plan_id
        and t.faculty_id = current_user_faculty_id()
    )
  );

-- university_admin, vice_rector, science_department: read all in university
create policy "university roles read all allocations"
  on teacher_allocations for select
  to authenticated
  using (
    current_user_role_name() in ('university_admin', 'vice_rector', 'science_department')
    and exists (
      select 1 from teacher_work_plans p
      where p.id = work_plan_id
        and p.university_id = current_user_university_id()
    )
  );

-- super_admin full access
create policy "super_admin full teacher_allocations"
  on teacher_allocations for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ----------------------------------------------------------------------------
-- Seed: one academic year for UzSWLU (will be picked up by the active flag)
-- ----------------------------------------------------------------------------
insert into academic_years (university_id, name, start_date, end_date, is_active)
select
  u.id,
  '2024-2025',
  '2024-09-01',
  '2025-06-30',
  true
from universities u
where u.short_code = 'UzSWLU'
on conflict do nothing;
