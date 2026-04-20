-- Some submissions have indicator_reviews stored as a JSON string value
-- instead of a JSON object. That prevents the UI from finding rejected
-- indicators by id.

update submissions
set indicator_reviews = (indicator_reviews #>> '{}')::jsonb
where jsonb_typeof(indicator_reviews) = 'string';
