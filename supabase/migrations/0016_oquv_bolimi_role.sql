-- ============================================================================
-- 0016: Add `oquv_bolimi` (Academic Affairs Office) role
--
-- University-scoped read role for monitoring teacher workloads across all
-- faculties/kafedras, with the same approve/reject power on submitted plans
-- that the dean has within a single faculty.
-- ============================================================================

insert into roles (name, description, scope) values
  ('oquv_bolimi', 'O''quv bo''limi — academic affairs office, university-wide workload monitor', 'university')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Read access — university scope
-- ---------------------------------------------------------------------------
-- academic_years / subjects / study_groups / study_group_members / subject_workloads
-- are already readable by anyone whose university_id matches (see 0015), so no
-- extra policy is needed for those tables.

create policy "oquv_bolimi reads all teachers"
  on teachers for select
  to authenticated
  using (
    current_user_role_name() = 'oquv_bolimi'
    and university_id = current_user_university_id()
  );

create policy "oquv_bolimi reads all plans"
  on teacher_work_plans for select
  to authenticated
  using (
    current_user_role_name() = 'oquv_bolimi'
    and university_id = current_user_university_id()
  );

create policy "oquv_bolimi reads all allocations"
  on teacher_allocations for select
  to authenticated
  using (
    current_user_role_name() = 'oquv_bolimi'
    and exists (
      select 1 from teacher_work_plans p
      where p.id = work_plan_id
        and p.university_id = current_user_university_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Approve / reject submitted plans — university scope
-- ---------------------------------------------------------------------------
create policy "oquv_bolimi approves submitted plans"
  on teacher_work_plans for update
  to authenticated
  using (
    current_user_role_name() = 'oquv_bolimi'
    and status = 'submitted'
    and university_id = current_user_university_id()
  )
  with check (
    current_user_role_name() = 'oquv_bolimi'
    and university_id = current_user_university_id()
  );
