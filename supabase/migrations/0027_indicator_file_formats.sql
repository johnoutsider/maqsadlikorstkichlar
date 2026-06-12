-- Per-indicator submission file formats.
-- Existing indicators keep the formats that were previously allowed globally.

alter table public.indicators
  add column if not exists allowed_file_extensions text[] not null
  default array['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xlsx']::text[];

alter table public.indicators
  drop constraint if exists indicators_allowed_file_extensions_chk;

alter table public.indicators
  add constraint indicators_allowed_file_extensions_chk
  check (
    cardinality(allowed_file_extensions) >= 1
    and allowed_file_extensions <@ array[
      'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xlsx',
      'zip', 'rar', '7z', 'tar', 'gz'
    ]::text[]
  );

-- The bucket remains capped at 10 MB. Add MIME types for the archive formats
-- that Ilmiy bo'lim can enable for individual indicators.
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-gzip'
  ]::text[]
where id = 'submissions';

-- Path:
-- {university_id}/{year}/{quarter}/{department_id}/{indicator_id}/{filename}
-- Enforce the selected indicator format during the storage insert as well as
-- in the browser.
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
        and lower(storage.extension(name)) = any(i.allowed_file_extensions)
    )
  );
