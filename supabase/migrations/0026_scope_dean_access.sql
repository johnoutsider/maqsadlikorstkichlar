-- Enforce faculty-scoped access for the dean role on targets and submission files.
-- Previously both were university-wide, allowing any dean to read other faculties'
-- data by removing client-side guards (e.g. disabled attribute on a <select>).

-- ---------------------------------------------------------------------------
-- A. targets_select: mirror the submissions_select scope model.
--    university_admin / vice_rector / science_department → whole university
--    dean                                                → own faculty
--    staff_manager                                       → own department
-- ---------------------------------------------------------------------------
drop policy if exists targets_select on targets;
create policy targets_select on targets for select to authenticated using (
  is_super_admin()
  or (university_id = current_user_university_id()
      and current_user_role_name() in ('university_admin', 'vice_rector', 'science_department'))
  or (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id())
  or (current_user_role_name() = 'staff_manager' and department_id = current_user_department_id())
);

-- ---------------------------------------------------------------------------
-- B. submissions_storage_select: align file-read ACL with the submissions table.
--    Path: {university_id}/{year}/{quarter}/{department_id}/{indicator_id}/{file}
--    path[1] = university_id  (1-indexed via storage.foldername)
--    path[4] = department_id
--    Dean's faculty is derived by joining departments — same EXISTS pattern as
--    progress_reports_storage_select in 0019_security_hardening.sql.
-- ---------------------------------------------------------------------------
drop policy if exists submissions_storage_select on storage.objects;
create policy submissions_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'submissions' and (
    is_super_admin()
    or (current_user_role_name() in ('university_admin', 'vice_rector', 'science_department')
        and (storage.foldername(name))[1] = current_user_university_id()::text)
    or (current_user_role_name() = 'staff_manager'
        and (storage.foldername(name))[1] = current_user_university_id()::text
        and (storage.foldername(name))[4] = current_user_department_id()::text)
    or (current_user_role_name() = 'dean'
        and (storage.foldername(name))[1] = current_user_university_id()::text
        and exists (
          select 1 from public.departments d
          where d.id::text = (storage.foldername(name))[4]
            and d.faculty_id = current_user_faculty_id()
        ))
  )
);
