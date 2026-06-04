-- Security hardening:
-- - Prevent role/scope escalation through public.users updates.
-- - Enforce server-side workflow transitions for submissions and work plans.
-- - Scope progress-report storage reads by university for science_department.
-- - Enforce bucket-level upload size and MIME restrictions.

-- ---------------------------------------------------------------------------
-- public.users: authenticated users may only update their display name.
-- Privileged user provisioning and deletion already goes through service-role
-- API routes, so direct browser updates to role/scope columns are not needed.
-- ---------------------------------------------------------------------------
revoke update on public.users from authenticated;
grant update (display_name) on public.users to authenticated;

drop policy if exists users_update on public.users;
drop policy if exists users_self_update_display_name on public.users;
drop policy if exists users_super_admin_update on public.users;

create policy users_self_update_display_name
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_super_admin_update
  on public.users for update
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- submissions: split broad UPDATE policy into role- and state-specific paths.
-- ---------------------------------------------------------------------------
drop policy if exists submissions_update on public.submissions;
drop policy if exists submissions_staff_update on public.submissions;
drop policy if exists submissions_dean_update on public.submissions;
drop policy if exists submissions_science_update on public.submissions;
drop policy if exists submissions_super_admin_update on public.submissions;

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
    and status in ('draft', 'pending_dean')
  );

create policy submissions_dean_update
  on public.submissions for update
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and faculty_id = current_user_faculty_id()
    and status = 'pending_dean'
  )
  with check (
    current_user_role_name() = 'dean'
    and faculty_id = current_user_faculty_id()
    and status in ('pending_science', 'needs_revision')
  );

create policy submissions_science_update
  on public.submissions for update
  to authenticated
  using (
    current_user_role_name() in ('university_admin', 'science_department')
    and university_id = current_user_university_id()
    and status = 'pending_science'
  )
  with check (
    current_user_role_name() in ('university_admin', 'science_department')
    and university_id = current_user_university_id()
    and status in ('approved', 'needs_revision')
  );

create policy submissions_super_admin_update
  on public.submissions for update
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

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
    if old.status not in ('draft', 'rejected', 'needs_revision')
      or new.status not in ('draft', 'pending_dean') then
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

drop trigger if exists enforce_submission_update_security on public.submissions;
create trigger enforce_submission_update_security
  before update on public.submissions
  for each row
  execute function public.enforce_submission_update_security();

-- ---------------------------------------------------------------------------
-- teacher_work_plans: keep reviewers and staff on valid workflow transitions.
-- ---------------------------------------------------------------------------
drop policy if exists "staff_manager updates draft/rejected plans" on public.teacher_work_plans;
drop policy if exists "dean approves submitted plans" on public.teacher_work_plans;
drop policy if exists "oquv_bolimi approves submitted plans" on public.teacher_work_plans;

create policy "staff_manager updates draft/rejected plans"
  on public.teacher_work_plans for update
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and status in ('draft', 'rejected')
    and exists (
      select 1 from public.teachers t
      where t.id = teacher_id
        and t.department_id = current_user_department_id()
    )
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and status in ('draft', 'submitted')
    and exists (
      select 1 from public.teachers t
      where t.id = teacher_id
        and t.department_id = current_user_department_id()
    )
  );

create policy "dean approves submitted plans"
  on public.teacher_work_plans for update
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and status = 'submitted'
    and exists (
      select 1 from public.teachers t
      where t.id = teacher_id
        and t.faculty_id = current_user_faculty_id()
    )
  )
  with check (
    current_user_role_name() = 'dean'
    and status in ('approved', 'rejected')
    and exists (
      select 1 from public.teachers t
      where t.id = teacher_id
        and t.faculty_id = current_user_faculty_id()
    )
  );

create policy "oquv_bolimi approves submitted plans"
  on public.teacher_work_plans for update
  to authenticated
  using (
    current_user_role_name() = 'oquv_bolimi'
    and status = 'submitted'
    and university_id = current_user_university_id()
  )
  with check (
    current_user_role_name() = 'oquv_bolimi'
    and status in ('approved', 'rejected')
    and university_id = current_user_university_id()
  );

create or replace function public.enforce_teacher_work_plan_update_security()
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
    or new.teacher_id is distinct from old.teacher_id
    or new.academic_year_id is distinct from old.academic_year_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Work plan ownership fields cannot be changed';
  end if;

  if role_name = 'staff_manager' then
    if old.status not in ('draft', 'rejected')
      or new.status not in ('draft', 'submitted') then
      raise exception 'Invalid staff work-plan status transition';
    end if;

    if new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Staff users cannot edit work-plan review fields';
    end if;

    return new;
  end if;

  if role_name in ('dean', 'oquv_bolimi') then
    if old.status <> 'submitted'
      or new.status not in ('approved', 'rejected') then
      raise exception 'Invalid reviewer work-plan status transition';
    end if;

    if new.position is distinct from old.position
      or new.stavka is distinct from old.stavka
      or new.submitted_at is distinct from old.submitted_at
      or new.reviewed_by is distinct from auth.uid() then
      raise exception 'Work-plan review update contains invalid field changes';
    end if;

    return new;
  end if;

  raise exception 'Role is not allowed to update work plans';
end;
$$;

drop trigger if exists enforce_teacher_work_plan_update_security on public.teacher_work_plans;
create trigger enforce_teacher_work_plan_update_security
  before update on public.teacher_work_plans
  for each row
  execute function public.enforce_teacher_work_plan_update_security();

-- ---------------------------------------------------------------------------
-- progress report files: science_department reads only own university.
-- ---------------------------------------------------------------------------
drop policy if exists progress_reports_storage_select on storage.objects;

create policy progress_reports_storage_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'progress-reports'
    and (
      is_super_admin()
      or (storage.foldername(name))[1] = current_user_doktorant_id()::text
      or exists (
        select 1 from public.doktorantlar d
        where d.id::text = (storage.foldername(name))[1]
          and d.supervisor_id = current_user_supervisor_id()
      )
      or (
        current_user_role_name() = 'science_department'
        and exists (
          select 1 from public.doktorantlar d
          where d.id::text = (storage.foldername(name))[1]
            and d.university_id = current_user_university_id()
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket upload constraints.
-- ---------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
where id = 'submissions';

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
where id = 'progress-reports';

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id in ('doktorant-avatars', 'university-logos');
