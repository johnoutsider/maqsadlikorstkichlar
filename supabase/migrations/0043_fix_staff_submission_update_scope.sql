-- ============================================================================
-- Fix staff submission UPDATE policy to match the per-user data model.
--
-- Migration 0039 re-keyed submissions to (submitted_by, year, quarter) and
-- updated the SELECT policy to use `submitted_by = auth.uid()`, but the UPDATE
-- policy (submissions_staff_update) was not updated at the same time.
-- It still uses `department_id = current_user_department_id()`, which breaks
-- for any user whose department_id in the DB doesn't exactly match the one
-- stored in the existing submission row (e.g. after a department reassignment
-- or when the row was originally created under the old department-keyed model).
--
-- Fix: switch both USING and WITH CHECK to `submitted_by = auth.uid()`,
-- consistent with the SELECT policy and the unique constraint.
-- Also add `submitted_by = auth.uid()` to the INSERT WITH CHECK so inserts
-- are equally consistent with the new model.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. UPDATE policy for staff_manager
-- ---------------------------------------------------------------------------
drop policy if exists submissions_staff_update on public.submissions;

create policy submissions_staff_update
  on public.submissions for update
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and submitted_by = auth.uid()
    and status in ('draft', 'rejected', 'needs_revision')
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and submitted_by = auth.uid()
    and university_id = current_user_university_id()
    and status in ('draft', 'pending_dean', 'needs_revision', 'rejected')
  );

-- ---------------------------------------------------------------------------
-- B. INSERT policy for staff_manager
--    Add submitted_by = auth.uid() guard so every new row is owned by the
--    inserting user, matching the (submitted_by, year, quarter) unique key.
-- ---------------------------------------------------------------------------
drop policy if exists submissions_insert on public.submissions;

create policy submissions_insert
  on public.submissions for insert
  to authenticated
  with check (
    current_user_role_name() = 'staff_manager'
    and submitted_by = auth.uid()
    and department_id = current_user_department_id()
    and university_id = current_user_university_id()
  );
