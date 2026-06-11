alter table indicators
  add column if not exists min_pages int,
  add column if not exists max_pages int;

alter table indicators
  add constraint indicators_page_bounds_chk
  check (
    (min_pages is null or min_pages >= 1)
    and (max_pages is null or max_pages >= 1)
    and (min_pages is null or max_pages is null or min_pages <= max_pages)
  );
