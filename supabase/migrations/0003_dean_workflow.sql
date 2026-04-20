-- ============================================================================
-- Dean-first approval workflow — PART 1 / 2
-- ============================================================================
-- Postgres requires new enum values to be committed before they can be used.
-- Run this file first (it adds the new statuses), then run 0004_dean_workflow_data.sql
-- in a SEPARATE query to backfill data and add the RLS policy.
-- ============================================================================

alter type submission_status add value if not exists 'pending_dean';
alter type submission_status add value if not exists 'pending_science';
alter type submission_status add value if not exists 'needs_revision';
