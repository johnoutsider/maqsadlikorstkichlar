-- ============================================================================
-- Re-assert department-scoped read access on submission files.
--
-- The original 0001_init policy let ANY authenticated user in the same
-- university read EVERY submission file (path[1] = university_id only). On
-- databases where 0026/0030 were never applied, this meant one kafedra could
-- open PDFs uploaded by other kafedras. This migration re-creates the correct,
-- department-scoped policy (identical to 0030) so it is enforced regardless of
-- which earlier migrations have run.
--
-- Path: {university_id}/{year}/{quarter}/{department_id}/{indicator_id}/{file}
--   foldername(name)[1] = university_id
--   foldername(name)[4] = department_id
--
-- Scope:
--   super_admin                                  → all
--   university_admin / vice_rector / science_*   → whole own university
--   staff_manager                                → own department only
--   dean                                         → own faculty, non-draft only
-- ============================================================================

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
