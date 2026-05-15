-- ============================================================================
-- HEMIS external API snapshots
-- Stores periodic snapshots fetched from student.uzswlu.uz public endpoints.
-- The route handler reads the latest snapshot; re-fetches from HEMIS when it
-- is older than 24 hours and writes a new row automatically.
-- ============================================================================

create table if not exists hemis_snapshots (
  id          uuid        primary key default gen_random_uuid(),
  source      text        not null,          -- HEMIS endpoint path, e.g. 'stat-employee'
  fetched_at  timestamptz not null default now(),
  data        jsonb       not null
);

-- Index for efficient "latest snapshot for source" query
create index if not exists hemis_snapshots_source_fetched_at
  on hemis_snapshots (source, fetched_at desc);

-- Keep only last 90 snapshots per source (prevent unbounded growth)
create or replace function hemis_snapshots_trim()
returns trigger language plpgsql as $$
begin
  delete from hemis_snapshots
  where source = NEW.source
    and id not in (
      select id from hemis_snapshots
      where source = NEW.source
      order by fetched_at desc
      limit 90
    );
  return null;
end;
$$;

drop trigger if exists hemis_snapshots_trim_trigger on hemis_snapshots;
create trigger hemis_snapshots_trim_trigger
  after insert on hemis_snapshots
  for each row execute function hemis_snapshots_trim();

-- RLS: authenticated users may read; only service role may insert
alter table hemis_snapshots enable row level security;

drop policy if exists "hemis_snapshots_read" on hemis_snapshots;
create policy "hemis_snapshots_read"
  on hemis_snapshots for select
  to authenticated
  using (true);
