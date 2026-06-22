-- Preserve column A from the source Excel registry.
alter table public.izlanuvchilar
  add column if not exists source_no text;
