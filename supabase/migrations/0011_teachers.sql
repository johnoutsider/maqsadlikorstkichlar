-- ============================================================================
-- Teachers directory (O'qituvchilar ro'yxati)
-- No auth login — staff_managers register teachers manually.
-- ============================================================================

create table if not exists teachers (
  id               uuid        primary key default gen_random_uuid(),
  university_id    uuid        not null references universities(id) on delete cascade,
  faculty_id       uuid        not null references faculties(id)    on delete cascade,
  department_id    uuid        not null references departments(id)  on delete cascade,

  -- Full name split into three parts
  last_name        text        not null,
  first_name       text        not null,
  middle_name      text,

  -- Personal details
  birth_date       date,
  gender           text        check (gender in ('erkak', 'ayol')),
  phone            text,
  email            text,
  passport_pinfl   text,

  -- Academic position
  ilmiy_daraja     text        check (ilmiy_daraja in ('fan_doktori', 'fan_nomzodi', 'phd', 'yoq')),
  ilmiy_unvon      text        check (ilmiy_unvon  in ('professor', 'dotsent', 'katta_oqituvchi', 'oqituvchi', 'assistent')),
  lavozim          text,

  -- Employment terms
  stavka           text        check (stavka in ('0.25', '0.5', '0.75', '1.0', '1.25', '1.5')),
  ish_turi         text        check (ish_turi in ('asosiy', 'orindosh')),
  ishga_kirgan_sana date,

  -- Status
  faoliyat_holati  text        not null default 'faol'
                               check (faoliyat_holati in ('faol', 'ishdan_ketgan', 'tatilda')),

  created_by       uuid        references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  create trigger teachers_updated_at
    before update on teachers
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table teachers enable row level security;

-- staff_manager: full CRUD for their own department
create policy "staff_manager manages own dept teachers"
  on teachers for all
  to authenticated
  using (
    current_user_role_name() = 'staff_manager'
    and department_id = (
      select department_id from users where id = auth.uid()
    )
  )
  with check (
    current_user_role_name() = 'staff_manager'
    and department_id = (
      select department_id from users where id = auth.uid()
    )
  );

-- dean: read teachers in their faculty
create policy "dean reads faculty teachers"
  on teachers for select
  to authenticated
  using (
    current_user_role_name() = 'dean'
    and faculty_id in (
      select id         from faculties where dean_user_id = auth.uid()
      union
      select faculty_id from users    where id = auth.uid() and faculty_id is not null
    )
  );

-- science_department, university_admin, vice_rector: read all in their university
create policy "university roles read all teachers"
  on teachers for select
  to authenticated
  using (
    current_user_role_name() in ('science_department', 'university_admin', 'vice_rector')
    and university_id = current_user_university_id()
  );

-- super_admin: read everything
create policy "super_admin reads all teachers"
  on teachers for select
  to authenticated
  using (current_user_role_name() = 'super_admin');
