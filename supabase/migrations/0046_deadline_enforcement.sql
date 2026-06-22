-- ============================================================================
-- Deadline enforcement: submissions INSERT/UPDATE va storage INSERT ga
-- deadline_blocks() tekshiruvini qo'shadi.
--
-- Faqat staff_manager ga ta'sir qiladi.
-- Reviewerlar (dean, science_department, university_admin) ta'sirlanmaydi.
-- Mavjud ma'lumotlarga (jadvallar, qatorlar) hech qanday o'zgarish yo'q.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. submissions INSERT — muddat o'tganda yangi qoralama ham yaratib bo'lmaydi
-- ----------------------------------------------------------------------------
drop policy if exists submissions_insert on public.submissions;

create policy submissions_insert
  on public.submissions for insert
  to authenticated
  with check (
    current_user_role_name() = 'staff_manager'
    and submitted_by = auth.uid()
    and department_id = current_user_department_id()
    and university_id = current_user_university_id()
    and not deadline_blocks(auth.uid(), year, quarter)
  );

-- ----------------------------------------------------------------------------
-- B. submissions UPDATE — muddat o'tganda saqlash, yuborish bloklanadi.
--    (needs_revision / rejected holati ham bloklanadi — reja bo'yicha qaror)
-- ----------------------------------------------------------------------------
drop policy if exists submissions_staff_update on public.submissions;

create policy submissions_staff_update
  on public.submissions for update
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and submitted_by = auth.uid()
    and status in ('draft', 'rejected', 'needs_revision')
    and not deadline_blocks(auth.uid(), year, quarter)
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and submitted_by = auth.uid()
    and university_id = current_user_university_id()
    and status in ('draft', 'pending_dean', 'needs_revision', 'rejected')
  );

-- ----------------------------------------------------------------------------
-- C. Storage INSERT — muddat o'tganda fayl yuklab bo'lmaydi.
--    Fayl yo'li: university_id/year/quarter/department_id/indicator_id/filename
--    Positions:         [1]       [2]   [3]       [4]          [5]        [6]
-- ----------------------------------------------------------------------------
drop policy if exists submissions_storage_insert on storage.objects;

create policy submissions_storage_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submissions'
    and current_user_role_name() = 'staff_manager'
    and (storage.foldername(name))[1] = current_user_university_id()::text
    and not deadline_blocks(
      auth.uid(),
      ((storage.foldername(name))[2])::int,
      ((storage.foldername(name))[3])::quarter
    )
  );
