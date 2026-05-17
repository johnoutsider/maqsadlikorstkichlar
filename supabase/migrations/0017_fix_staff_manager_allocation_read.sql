-- The original "staff_manager manages own allocations" policy used the same
-- status filter (draft/rejected) on both reads AND writes. This caused
-- allocations to become invisible to the staff_manager after a plan was
-- submitted, approved, or rejected.
--
-- Fix: replace the single `for all` policy with:
--   1. A `for select` policy — no status restriction (can always view own dept)
--   2. A `for insert`, `for update`, `for delete` policy — status restricted to
--      draft/rejected (cannot mutate a submitted/approved plan)

drop policy if exists "staff_manager manages own allocations" on teacher_allocations;

-- READ: staff_manager can always view allocations for their department's teachers
create policy "staff_manager reads own dept allocations"
  on teacher_allocations for select
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and exists (
      select 1 from teacher_work_plans p
      join teachers t on t.id = p.teacher_id
      where p.id = work_plan_id
        and t.department_id = current_user_department_id()
    )
  );

-- WRITE: staff_manager can only insert/update/delete when plan is draft or rejected
create policy "staff_manager writes own dept allocations"
  on teacher_allocations for insert
  to authenticated
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

create policy "staff_manager updates own dept allocations"
  on teacher_allocations for update
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

create policy "staff_manager deletes own dept allocations"
  on teacher_allocations for delete
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
  );
