-- ============================================================================
-- Multi-role users: grant table + role switching RPCs.
-- users.role_id remains the ACTIVE role (unchanged meaning, drives all RLS).
-- user_roles lists every role a user is granted; one is marked primary.
-- ============================================================================

create table if not exists public.user_roles (
  user_id    uuid not null references public.users(id) on delete cascade,
  role_id    uuid not null references public.roles(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Exactly one primary role per user.
create unique index if not exists user_roles_one_primary
  on public.user_roles (user_id) where is_primary;

-- Backfill: every existing user's current role becomes their primary grant.
insert into public.user_roles (user_id, role_id, is_primary)
select id, role_id, true from public.users
on conflict do nothing;

-- Switch the caller's active role to one they are granted.
create or replace function public.switch_active_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role_id = p_role_id
  ) then
    raise exception 'Role not granted to user';
  end if;

  update public.users set role_id = p_role_id where id = auth.uid();
end;
$$;

grant execute on function public.switch_active_role(uuid) to authenticated;

-- Reset the caller's active role back to their primary grant (called on login).
create or replace function public.reset_to_primary_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users u
  set role_id = ur.role_id
  from public.user_roles ur
  where u.id = auth.uid()
    and ur.user_id = auth.uid()
    and ur.is_primary;
end;
$$;

grant execute on function public.reset_to_primary_role() to authenticated;

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select
  on public.user_roles for select
  to authenticated
  using (
    is_super_admin()
    or user_id = auth.uid()
    or (
      current_user_role_name() in ('university_admin', 'science_department')
      and exists (
        select 1 from public.users target
        where target.id = user_roles.user_id
          and target.university_id = current_user_university_id()
      )
    )
  );
