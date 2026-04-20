-- ============================================================================
-- Dean-first approval workflow — PART 2 / 2
-- ============================================================================
-- Run AFTER 0003_dean_workflow.sql has been committed (as a separate query).
-- This file:
--   1) migrates existing 'pending' submissions to 'pending_dean',
--   2) adds per-indicator review + audit-trail columns,
--   3) lets deans UPDATE submissions within their faculty.
-- ============================================================================

-- 1) Migrate existing pending submissions to the new dean-first state.
update submissions set status = 'pending_dean' where status = 'pending';

-- 2) Per-indicator decisions + audit history.
--    indicator_reviews shape:
--      { "<indicator_id>": {
--          "dean":    { "status":"approved"|"rejected", "comment":"...", "by":"uuid", "at":"iso" } | null,
--          "science": { "status":"approved"|"rejected", "comment":"...", "by":"uuid", "at":"iso" } | null
--        } }
--    review_history shape (append-only):
--      [ { "stage":"dean"|"science", "reviewer_id":"...", "at":"iso",
--          "outcome":"advanced"|"needs_revision"|"approved",
--          "overall_comment":"...",
--          "decisions":[ { "indicator_id":"...", "status":"...", "comment":"..." } ] } ]
alter table submissions
  add column if not exists indicator_reviews jsonb not null default '{}'::jsonb,
  add column if not exists review_history    jsonb not null default '[]'::jsonb;

-- 3) RLS — let the dean update submissions for their faculty.
drop policy if exists submissions_update on submissions;
create policy submissions_update on submissions for update to authenticated using (
  is_super_admin()
  or (current_user_role_name() = 'staff_manager' and department_id = current_user_department_id())
  or (current_user_role_name() in ('university_admin','science_department')
      and university_id = current_user_university_id())
  or (current_user_role_name() = 'dean' and faculty_id = current_user_faculty_id())
);
