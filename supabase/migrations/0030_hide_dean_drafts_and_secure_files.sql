-- Keep draft submissions and their uploaded files private from deans.
-- Files remain in storage and become readable automatically after the staff
-- manager submits the report (status changes away from draft).

-- ---------------------------------------------------------------------------
-- Submission rows: deans can read only non-draft reports in their faculty.
-- Other roles retain their existing scopes.
-- ---------------------------------------------------------------------------
drop policy if exists submissions_select on public.submissions;

create policy submissions_select
  on public.submissions for select
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
    or (
      current_user_role_name() = 'dean'
      and faculty_id = current_user_faculty_id()
      and status <> 'draft'
    )
    or (
      current_user_role_name() = 'staff_manager'
      and department_id = current_user_department_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Submission files: a dean can read an object only when its exact storage path
-- is referenced by a non-draft submission in the dean's faculty.
-- Path: {university_id}/{year}/{quarter}/{department_id}/{indicator_id}/{file}
-- ---------------------------------------------------------------------------
drop policy if exists submissions_storage_select on storage.objects;

create policy submissions_storage_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submissions'
    and (
      is_super_admin()
      or (
        current_user_role_name() in (
          'university_admin',
          'vice_rector',
          'science_department'
        )
        and (storage.foldername(name))[1] = current_user_university_id()::text
      )
      or (
        current_user_role_name() = 'staff_manager'
        and (storage.foldername(name))[1] = current_user_university_id()::text
        and (storage.foldername(name))[4] = current_user_department_id()::text
      )
      or (
        current_user_role_name() = 'dean'
        and (storage.foldername(name))[1] = current_user_university_id()::text
        and exists (
          select 1
          from public.submissions s
          cross join lateral jsonb_each(coalesce(s.indicators, '{}'::jsonb))
            as indicator_entry(indicator_id, payload)
          where s.university_id = current_user_university_id()
            and s.faculty_id = current_user_faculty_id()
            and s.department_id::text = (storage.foldername(name))[4]
            and s.status <> 'draft'
            and jsonb_typeof(indicator_entry.payload -> 'files') = 'array'
            and (indicator_entry.payload -> 'files') ? name
        )
      )
    )
  );
