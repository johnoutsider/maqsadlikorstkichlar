-- Backfill app users for existing supervisor/doktorant domain profiles
-- and create placeholder domain profiles for any legacy public.users rows
-- that were created without matching doktorantura tables.

WITH supervisor_role AS (
  SELECT id FROM public.roles WHERE name = 'supervisor'
)
INSERT INTO public.users (
  id,
  university_id,
  role_id,
  faculty_id,
  department_id,
  display_name,
  email,
  must_change_password,
  created_by
)
SELECT
  s.auth_user_id,
  COALESCE(s.university_id, u.id),
  (SELECT id FROM supervisor_role),
  s.faculty_id,
  s.department_id,
  s.full_name,
  s.email,
  false,
  NULL
FROM public.supervisors s
LEFT JOIN public.universities u ON u.id = s.university_id
LEFT JOIN public.users existing ON existing.id = s.auth_user_id
WHERE s.auth_user_id IS NOT NULL
  AND existing.id IS NULL;

WITH doktorant_role AS (
  SELECT id FROM public.roles WHERE name = 'doktorant'
)
INSERT INTO public.users (
  id,
  university_id,
  role_id,
  faculty_id,
  department_id,
  display_name,
  email,
  must_change_password,
  created_by
)
SELECT
  d.auth_user_id,
  d.university_id,
  (SELECT id FROM doktorant_role),
  d.faculty_id,
  d.department_id,
  d.full_name,
  au.email,
  false,
  NULL
FROM public.doktorantlar d
JOIN auth.users au ON au.id = d.auth_user_id
LEFT JOIN public.users existing ON existing.id = d.auth_user_id
WHERE d.auth_user_id IS NOT NULL
  AND existing.id IS NULL;

INSERT INTO public.supervisors (
  auth_user_id,
  university_id,
  faculty_id,
  department_id,
  full_name,
  staff_id,
  academic_title,
  workplace,
  is_external,
  email,
  metadata
)
SELECT
  u.id,
  u.university_id,
  u.faculty_id,
  u.department_id,
  u.display_name,
  'AUTO-' || substr(replace(u.id::text, '-', ''), 1, 12),
  'Belgilanmagan',
  NULL,
  false,
  u.email,
  jsonb_build_object('backfilled', true, 'requires_review', true)
FROM public.users u
JOIN public.roles r ON r.id = u.role_id
LEFT JOIN public.supervisors s ON s.auth_user_id = u.id
WHERE r.name = 'supervisor'
  AND s.id IS NULL;

INSERT INTO public.doktorantlar (
  auth_user_id,
  university_id,
  faculty_id,
  department_id,
  supervisor_id,
  full_name,
  student_id,
  enrollment_year,
  research_topic,
  thesis_status,
  metadata
)
SELECT
  u.id,
  u.university_id,
  u.faculty_id,
  u.department_id,
  NULL,
  u.display_name,
  'AUTO-' || substr(replace(u.id::text, '-', ''), 1, 12),
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  'Mavzu kiritilmagan',
  'taklif',
  jsonb_build_object('backfilled', true, 'requires_review', true)
FROM public.users u
JOIN public.roles r ON r.id = u.role_id
LEFT JOIN public.doktorantlar d ON d.auth_user_id = u.id
WHERE r.name = 'doktorant'
  AND d.id IS NULL;
