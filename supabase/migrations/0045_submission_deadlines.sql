-- ============================================================================
-- Submission deadlines: ilmiy bo'lim hisobot yuborish muddatlarini belgilaydi.
--
-- submission_deadlines — har bir (university, year, quarter) uchun bitta muddat.
-- submission_deadline_users — applies_to='specific' bo'lganda tanlangan userlar.
-- deadline_blocks() — RLS funksiyasi: muddat o'tganmi?
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Asosiy muddat jadvali
-- ----------------------------------------------------------------------------
create table if not exists public.submission_deadlines (
  id             uuid        primary key default gen_random_uuid(),
  university_id  uuid        not null references public.universities(id) on delete cascade,
  year           int         not null,
  quarter        quarter     not null,
  deadline_at    timestamptz not null,
  applies_to     text        not null default 'all' check (applies_to in ('all', 'specific')),
  is_active      boolean     not null default true,
  created_by     uuid        references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (university_id, year, quarter)
);

-- ----------------------------------------------------------------------------
-- 2. Tanlangan mas'ullar jadvali (applies_to='specific' bo'lganda)
-- ----------------------------------------------------------------------------
create table if not exists public.submission_deadline_users (
  deadline_id  uuid not null references public.submission_deadlines(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  primary key (deadline_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. deadline_blocks() — RLS va UI uchun yordamchi funksiya.
--    true qaytarsa: ushbu user uchun muddat o'tgan (bloklash kerak).
--    false qaytarsa: muddat yo'q yoki hali kelmagan.
-- ----------------------------------------------------------------------------
create or replace function public.deadline_blocks(
  p_user_id uuid,
  p_year    int,
  p_quarter quarter
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submission_deadlines d
    where d.university_id = (
            select university_id from public.users
            where id = p_user_id
          )
      and d.year      = p_year
      and d.quarter   = p_quarter
      and d.is_active = true
      and now() > d.deadline_at
      and (
        d.applies_to = 'all'
        or exists (
          select 1
          from public.submission_deadline_users du
          where du.deadline_id = d.id
            and du.user_id = p_user_id
        )
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS for submission_deadlines
-- ----------------------------------------------------------------------------
alter table public.submission_deadlines enable row level security;

-- science_department va university_admin: to'liq boshqaruv (o'z universiteti)
drop policy if exists deadlines_manage on public.submission_deadlines;
create policy deadlines_manage
  on public.submission_deadlines for all
  to authenticated
  using (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in ('science_department', 'university_admin')
    )
  )
  with check (
    is_super_admin()
    or (
      university_id = current_user_university_id()
      and current_user_role_name() in ('science_department', 'university_admin')
    )
  );

-- Boshqa rollar: faqat o'qish (countdown ko'rsatish uchun)
drop policy if exists deadlines_select_others on public.submission_deadlines;
create policy deadlines_select_others
  on public.submission_deadlines for select
  to authenticated
  using (
    university_id = current_user_university_id()
    and current_user_role_name() in (
      'staff_manager', 'dean', 'vice_rector'
    )
  );

-- ----------------------------------------------------------------------------
-- 5. RLS for submission_deadline_users
-- ----------------------------------------------------------------------------
alter table public.submission_deadline_users enable row level security;

-- Faqat science_department va university_admin boshqaradi
drop policy if exists deadline_users_manage on public.submission_deadline_users;
create policy deadline_users_manage
  on public.submission_deadline_users for all
  to authenticated
  using (
    is_super_admin()
    or exists (
      select 1 from public.submission_deadlines d
      where d.id = deadline_id
        and d.university_id = current_user_university_id()
        and current_user_role_name() in ('science_department', 'university_admin')
    )
  )
  with check (
    is_super_admin()
    or exists (
      select 1 from public.submission_deadlines d
      where d.id = deadline_id
        and d.university_id = current_user_university_id()
        and current_user_role_name() in ('science_department', 'university_admin')
    )
  );

-- staff_manager o'ziga tegishli muddatni o'qiy oladi
drop policy if exists deadline_users_select_staff on public.submission_deadline_users;
create policy deadline_users_select_staff
  on public.submission_deadline_users for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.submission_deadlines d
      where d.id = deadline_id
        and d.university_id = current_user_university_id()
        and current_user_role_name() in ('science_department', 'university_admin', 'vice_rector', 'dean')
    )
  );
