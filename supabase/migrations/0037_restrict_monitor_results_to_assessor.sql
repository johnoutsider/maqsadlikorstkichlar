-- Monitors may only read monitoring results they created. University-level
-- oversight roles keep access to all results within their university.

drop policy if exists monitoring_evaluations_select
  on public.monitoring_evaluations;
create policy monitoring_evaluations_select
  on public.monitoring_evaluations for select
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and (
        current_user_role_name() in (
          'university_admin',
          'vice_rector',
          'science_department'
        )
        or (
          current_user_role_name() = 'monitor'
          and created_by = auth.uid()
        )
      )
    )
  );

drop policy if exists monitoring_evaluation_items_select
  on public.monitoring_evaluation_items;
create policy monitoring_evaluation_items_select
  on public.monitoring_evaluation_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.monitoring_evaluations evaluation
      where evaluation.id = monitoring_evaluation_items.evaluation_id
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

-- Deletion belongs to the science department oversight workflow, not monitors.
drop policy if exists monitoring_evaluations_delete
  on public.monitoring_evaluations;
create policy monitoring_evaluations_delete
  on public.monitoring_evaluations for delete
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() = 'science_department'
    )
  );
