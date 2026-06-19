alter table public.indicators
  add column if not exists description text,
  add column if not exists min_files int not null default 0;

alter table public.indicators
  drop constraint if exists indicators_min_files_chk;

alter table public.indicators
  add constraint indicators_min_files_chk
  check (min_files >= 0);
