-- ============================================================================
-- Snapshot the researcher's course, admission year, and submission date onto
-- each monitoring evaluation so the natijalar list can filter by them even
-- if the source izlanuvchi record changes later.
-- ============================================================================

alter table public.monitoring_evaluations
  add column if not exists course text,
  add column if not exists admission_year text,
  add column if not exists submission_date date;
