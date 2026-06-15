-- ============================================================================
-- Audit log for edits made to monitoring_evaluations / monitoring_evaluation_items.
-- Each row records a single field change (score or comment) made while
-- editing an existing evaluation, including who made it, when, from what
-- kind of device, and from what IP address.
-- ============================================================================

create table if not exists public.monitoring_evaluation_logs (
  id                uuid primary key default gen_random_uuid(),
  evaluation_id     uuid not null references public.monitoring_evaluations(id) on delete cascade,
  university_id     uuid not null references public.universities(id) on delete cascade,
  changed_by        uuid not null references public.users(id) on delete restrict,
  changed_by_name   text not null,
  device_kind       text not null check (device_kind in ('kompyuter', 'mobil')),
  ip_address        text,
  criterion_key     text not null,
  indicator_label   text not null,
  field             text not null check (field in ('score', 'comment')),
  old_value         text,
  new_value         text,
  created_at        timestamptz not null default now()
);

create index if not exists monitoring_evaluation_logs_evaluation_idx
  on public.monitoring_evaluation_logs (evaluation_id, created_at desc);

alter table public.monitoring_evaluation_logs enable row level security;

-- SELECT: same audience as monitoring_evaluations_select — monitors see only
-- logs for evaluations they created, university oversight roles see all.
drop policy if exists monitoring_evaluation_logs_select
  on public.monitoring_evaluation_logs;
create policy monitoring_evaluation_logs_select
  on public.monitoring_evaluation_logs for select
  to authenticated
  using (
    exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_logs.evaluation_id
        and (
          is_super_admin()
          or (
            evaluation.university_id = current_user_university_id()
            and (
              current_user_role_name() in (
                'university_admin',
                'vice_rector',
                'science_department'
              )
              or (
                current_user_role_name() = 'monitor'
                and evaluation.created_by = auth.uid()
              )
            )
          )
        )
    )
  );

-- INSERT: only the monitor who created the evaluation can log changes to it,
-- and only as themselves.
drop policy if exists monitoring_evaluation_logs_insert
  on public.monitoring_evaluation_logs;
create policy monitoring_evaluation_logs_insert
  on public.monitoring_evaluation_logs for insert
  to authenticated
  with check (
    changed_by = auth.uid()
    and university_id = current_user_university_id()
    and exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_logs.evaluation_id
        and evaluation.university_id = monitoring_evaluation_logs.university_id
        and evaluation.created_by = auth.uid()
    )
  );

-- Logs are immutable; no update/delete policies are defined, so those
-- operations are denied by default once RLS is enabled.
