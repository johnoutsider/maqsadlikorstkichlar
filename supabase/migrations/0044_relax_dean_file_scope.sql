-- ============================================================================
-- Relax the dean branch of submissions_storage_select.
--
-- The dean file-read policy (from 0039) required the file path's department
-- segment to equal the submission's department_id:
--     s.department_id::text = (storage.foldername(name))[4]
--
-- That coupling breaks whenever a submission is re-pointed to a corrected
-- department faster than its files are moved (and during the one-time backfill
-- itself). A dean's true scope is "non-draft submissions in my faculty" — the
-- file's physical folder is irrelevant to that. We therefore drop the
-- folder[4] coupling and rely on:
--   * faculty_id match (the dean's real scope), and
--   * the file actually being referenced by such a submission's indicators.
--
-- Other roles (super_admin, university scope, staff_manager) are unchanged.
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
        and exists (
          select 1
          from public.submissions s
          cross join lateral jsonb_each(coalesce(s.indicators, '{}'::jsonb))
            as indicator_entry(indicator_id, payload)
          where s.submitted_by = auth.uid()
            and jsonb_typeof(indicator_entry.payload -> 'files') = 'array'
            and (indicator_entry.payload -> 'files') ? name
        )
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
            and s.status <> 'draft'
            and jsonb_typeof(indicator_entry.payload -> 'files') = 'array'
            and (indicator_entry.payload -> 'files') ? name
        )
      )
    )
  );
