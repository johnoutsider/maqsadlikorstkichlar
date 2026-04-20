-- Normalize legacy rejected submissions into the current revision workflow.
-- If a submission has per-indicator review data with at least one rejected
-- decision, it should be editable by staff as needs_revision rather than
-- remaining in the old rejected state.

update submissions
set status = 'needs_revision'
where status = 'rejected'
  and exists (
    select 1
    from jsonb_each(coalesce(indicator_reviews, '{}'::jsonb)) as r(key, value)
    where coalesce(r.value->'dean'->>'status', '') = 'rejected'
       or coalesce(r.value->'science'->>'status', '') = 'rejected'
  );
