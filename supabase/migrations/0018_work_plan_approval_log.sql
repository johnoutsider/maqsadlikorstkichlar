-- Approval / rejection audit log for teacher work plans.
-- Each approve or reject action by a dean or oquv_bolimi reviewer is
-- recorded here. The log is visible to everyone who can read the plan.

create table if not exists work_plan_approval_logs (
  id            uuid        primary key default gen_random_uuid(),
  work_plan_id  uuid        not null references teacher_work_plans(id) on delete cascade,
  reviewer_id   uuid        not null references users(id)              on delete cascade,
  reviewer_name text        not null,   -- denormalized: users.display_name at review time
  reviewer_role text        not null,   -- denormalized: role name at review time
  action        text        not null check (action in ('approved', 'rejected')),
  reason        text,                   -- required when action = 'rejected'
  created_at    timestamptz not null default now()
);

create index if not exists idx_wpal_work_plan on work_plan_approval_logs (work_plan_id);

alter table work_plan_approval_logs enable row level security;

-- READ: anyone in the same university who can read plans can read logs
create policy "university members read approval logs"
  on work_plan_approval_logs for select
  to authenticated
  using (
    exists (
      select 1 from teacher_work_plans p
      where p.id = work_plan_id
        and (
          is_super_admin()
          or p.university_id = current_user_university_id()
        )
    )
  );

-- INSERT: dean (faculty scope) can log reviews for their faculty's plans
create policy "dean inserts approval logs"
  on work_plan_approval_logs for insert
  to authenticated
  with check (
    current_user_role_name() = 'dean'
    and reviewer_id = auth.uid()
    and exists (
      select 1 from teacher_work_plans p
      join teachers t on t.id = p.teacher_id
      where p.id = work_plan_id
        and t.faculty_id = current_user_faculty_id()
    )
  );

-- INSERT: oquv_bolimi (university scope) can log reviews for any plan in their university
create policy "oquv_bolimi inserts approval logs"
  on work_plan_approval_logs for insert
  to authenticated
  with check (
    current_user_role_name() = 'oquv_bolimi'
    and reviewer_id = auth.uid()
    and exists (
      select 1 from teacher_work_plans p
      where p.id = work_plan_id
        and p.university_id = current_user_university_id()
    )
  );

-- super_admin full access
create policy "super_admin full approval logs"
  on work_plan_approval_logs for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());
