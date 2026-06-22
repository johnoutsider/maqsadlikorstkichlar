-- ============================================================================
-- Scope reports per submitting user, not per department.
--
-- Several "Kafedra Mas'uli" accounts share one department_id, so the old
-- model (one submission row per department/year/quarter, unique on
-- department_id) made them all write to — and read — the same row. Each user
-- saw every other user's uploaded files. Each account is in fact a separate
-- kafedra, so a report must belong to the user who submits it.
--
-- After this migration each user has their own submission row per period,
-- keyed by (submitted_by, year, quarter), and RLS only lets a staff_manager
-- read their own rows and their own files.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Re-key submissions: one row per (submitted_by, year, quarter).
--    The old department-based unique constraint blocked two users in the same
--    department from each having their own row, so it must go.
-- ---------------------------------------------------------------------------
alter table public.submissions
  drop constraint if exists submissions_department_id_year_quarter_key;

-- Idempotent: drop first so re-running this migration never fails with 42P07.
alter table public.submissions
  drop constraint if exists submissions_submitted_by_year_quarter_key;

alter table public.submissions
  add constraint submissions_submitted_by_year_quarter_key
  unique (submitted_by, year, quarter);

-- ---------------------------------------------------------------------------
-- B. submissions_select: a staff_manager reads only their OWN submissions.
--    Reviewer roles keep their existing university/faculty scopes.
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
      and submitted_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- C. submissions_storage_select: a staff_manager reads only files referenced
--    by their OWN submission rows (not the whole department folder). Reviewer
--    roles keep their existing scopes.
--    Path: {university_id}/{year}/{quarter}/{department_id}/{indicator_id}/{file}
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
            and s.department_id::text = (storage.foldername(name))[4]
            and s.status <> 'draft'
            and jsonb_typeof(indicator_entry.payload -> 'files') = 'array'
            and (indicator_entry.payload -> 'files') ? name
        )
      )
    )
  );
