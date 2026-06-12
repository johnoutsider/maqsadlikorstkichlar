-- 0027 replaced submissions_storage_insert with a version that calls
-- storage.extension(name), which does not exist on this project's storage
-- schema. That CREATE POLICY statement failed after the preceding
-- "drop policy if exists" had already run, leaving the submissions bucket
-- with no INSERT policy at all -- every upload was rejected with
-- "new row violates row-level security policy", regardless of path or file
-- type.
--
-- Recreate the policy with the same rules as 0027, but derive the file
-- extension with plain string functions instead of storage.extension().

drop policy if exists submissions_storage_insert on storage.objects;

create policy submissions_storage_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submissions'
    and current_user_role_name() = 'staff_manager'
    and (storage.foldername(name))[1] = current_user_university_id()::text
    and (storage.foldername(name))[4] = current_user_department_id()::text
    and exists (
      select 1
      from public.indicators i
      where i.id::text = (storage.foldername(name))[5]
        and i.university_id = current_user_university_id()
        and lower(split_part(name, '.', array_length(string_to_array(name, '.'), 1)))
            = any(i.allowed_file_extensions)
    )
  );
