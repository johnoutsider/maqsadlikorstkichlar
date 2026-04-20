-- Move targets from faculty-level to department-level.
-- Faculty totals become derivable sums of their departments' targets.
-- Since the app is pre-production with empty data, we recreate the table.

drop table if exists targets cascade;

create table targets (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  year int not null,
  quarter quarter not null,
  values jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (department_id, year, quarter)
);

create index idx_targets_lookup on targets (university_id, year, quarter);
create index idx_targets_faculty on targets (faculty_id, year, quarter);

alter table targets enable row level security;

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
