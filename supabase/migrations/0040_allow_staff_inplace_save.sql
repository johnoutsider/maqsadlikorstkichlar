-- ============================================================================
-- Allow a staff_manager to save a report IN PLACE without changing its status.
--
-- The form now auto-saves on every edit. While a report is being worked on it
-- keeps its current status (a draft stays 'draft'; a returned report stays
-- 'needs_revision' / 'rejected' so only the rejected indicators stay editable).
-- The previous rules only let staff move a report to 'draft' or 'pending_dean',
-- so auto-saving a returned report failed with
-- "Invalid staff submission status transition".
--
-- This migration permits staff to keep the same status (in-place save) in
-- addition to the existing transitions. It does NOT open any new transition to
-- approved / pending_science.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. RLS WITH CHECK: widen the allowed resulting status for staff updates.
--    The exact transition is still enforced by the trigger below (which can
--    compare old vs new). USING is unchanged: staff may only touch rows that
--    are currently draft / rejected / needs_revision.
-- ---------------------------------------------------------------------------
drop policy if exists submissions_staff_update on public.submissions;

create policy submissions_staff_update
  on public.submissions for update
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and department_id = current_user_department_id()
    and status in ('draft', 'rejected', 'needs_revision')
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and department_id = current_user_department_id()
    and university_id = current_user_university_id()
    and status in ('draft', 'pending_dean', 'needs_revision', 'rejected')
  );

-- ---------------------------------------------------------------------------
-- B. Trigger: allow staff to keep the same status (in-place save) on a
--    draft / needs_revision / rejected row, on top of the existing
--    -> draft / -> pending_dean transitions. All other branches unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_submission_update_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text := current_user_role_name();
begin
  if auth.role() = 'service_role' or is_super_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.university_id is distinct from old.university_id
    or new.faculty_id is distinct from old.faculty_id
    or new.department_id is distinct from old.department_id
    or new.year is distinct from old.year
    or new.quarter is distinct from old.quarter
    or new.submitted_by is distinct from old.submitted_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Submission ownership fields cannot be changed';
  end if;

  if role_name = 'staff_manager' then
    -- Allowed: an in-place save (status unchanged) on an editable row, or a
    -- transition to draft / pending_dean.
    if old.status not in ('draft', 'rejected', 'needs_revision')
      or not (
        new.status in ('draft', 'pending_dean')
        or new.status = old.status
      ) then
      raise exception 'Invalid staff submission status transition';
    end if;

    if new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.review_comment is distinct from old.review_comment
      or new.review_history is distinct from old.review_history then
      raise exception 'Staff users cannot edit review fields';
    end if;

    return new;
  end if;

  if role_name = 'dean' then
    if old.status <> 'pending_dean'
      or new.status not in ('pending_science', 'needs_revision') then
      raise exception 'Invalid dean submission status transition';
    end if;

    if new.indicators is distinct from old.indicators
      or new.submitted_at is distinct from old.submitted_at
      or new.reviewed_by is distinct from auth.uid() then
      raise exception 'Dean review update contains invalid field changes';
    end if;

    return new;
  end if;

  if role_name in ('university_admin', 'science_department') then
    if old.status <> 'pending_science'
      or new.status not in ('approved', 'needs_revision') then
      raise exception 'Invalid science submission status transition';
    end if;

    if new.indicators is distinct from old.indicators
      or new.submitted_at is distinct from old.submitted_at
      or new.reviewed_by is distinct from auth.uid() then
      raise exception 'Science review update contains invalid field changes';
    end if;

    return new;
  end if;

  raise exception 'Role is not allowed to update submissions';
end;
$$;
