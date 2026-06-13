-- 0027 added an EXISTS subquery against public.indicators inside the
-- submissions_storage_insert WITH CHECK clause to enforce the per-indicator
-- file-extension whitelist at the database level. In the storage RLS
-- execution context that subquery does not behave like a normal REST select
-- (indicators has its own RLS), so it evaluated to false and every upload was
-- rejected with "new row violates row-level security policy".
--
-- Restore the original (pre-0027) insert rules that are known to work.
-- File-extension validation is still enforced in the browser
-- (src/lib/upload-validation.ts -> submissionFileRule / validateFile) and the
-- bucket-level allowed_mime_types list still applies, so disallowed formats are
-- still blocked -- just not via this RLS subquery.

drop policy if exists submissions_storage_insert on storage.objects;

create policy submissions_storage_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submissions'
    and current_user_role_name() = 'staff_manager'
    and (storage.foldername(name))[1] = current_user_university_id()::text
    and (storage.foldername(name))[4] = current_user_department_id()::text
  );
