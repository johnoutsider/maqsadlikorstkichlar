-- 1. Create the supervisors table
CREATE TABLE public.supervisors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id    UUID REFERENCES public.universities(id) ON DELETE SET NULL, -- NULL if external
  faculty_id       UUID REFERENCES public.faculties(id) ON DELETE SET NULL,
  department_id    UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  full_name        TEXT NOT NULL,
  staff_id         TEXT UNIQUE NOT NULL,
  academic_title   TEXT NOT NULL,
  workplace        TEXT,
  is_external      BOOLEAN NOT NULL DEFAULT false,
  email            TEXT UNIQUE NOT NULL,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the doktorantlar table
CREATE TABLE public.doktorantlar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id    UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  faculty_id       UUID REFERENCES public.faculties(id) ON DELETE SET NULL,
  department_id    UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  supervisor_id    UUID REFERENCES public.supervisors(id) ON DELETE SET NULL,
  full_name        TEXT NOT NULL,
  student_id       TEXT UNIQUE NOT NULL,
  enrollment_year  INT NOT NULL,
  research_topic   TEXT NOT NULL,
  thesis_status    TEXT NOT NULL DEFAULT 'taklif'
                     CHECK (thesis_status IN (
                       'taklif',
                       'jarayonda',
                       'korib_chiqilmoqda',
                       'himoyalangan',
                       'yakunlangan'
                     )),
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 3. Create the evaluations table
CREATE TABLE public.evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doktorant_id      UUID NOT NULL REFERENCES public.doktorantlar(id) ON DELETE CASCADE,
  supervisor_id     UUID NOT NULL REFERENCES public.supervisors(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  overall_rating    INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  research_progress TEXT NOT NULL,
  strengths         TEXT,
  areas_to_improve  TEXT,
  recommendation    TEXT NOT NULL
                      CHECK (recommendation IN ('davom_etsin', 'qayta_korib_chiqsin', 'muddatni_uzaytirsin')),
  comments          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 4. Create the progress_reports table
CREATE TABLE public.progress_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doktorant_id     UUID NOT NULL REFERENCES public.doktorantlar(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  description      TEXT NOT NULL,
  file_urls        TEXT[] DEFAULT '{}',
  supervisor_feedback TEXT,
  feedback_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 5. Add Roles
INSERT INTO public.roles (name, description, scope) VALUES
  ('supervisor',  'Ilmiy rahbar — manages assigned doctorate students', 'university'),
  ('doktorant',   'Doktorant talaba — doctorate student account',        'university')
ON CONFLICT (name) DO NOTHING;

-- 6. Storage Bucket for progress reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-reports', 'progress-reports', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Define RLS Policies
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doktorantlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;

-- Helper to check user auth_user_id against supervisors/doktorantlar
CREATE OR REPLACE FUNCTION current_user_supervisor_id() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.supervisors WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION current_user_doktorant_id() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.doktorantlar WHERE auth_user_id = auth.uid()
$$;

-- RLS: supervisors
CREATE POLICY supervisors_select ON public.supervisors FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
  OR auth_user_id = auth.uid()
);
CREATE POLICY supervisors_insert ON public.supervisors FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
);
CREATE POLICY supervisors_update ON public.supervisors FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
  OR auth_user_id = auth.uid()
);
CREATE POLICY supervisors_delete ON public.supervisors FOR DELETE TO authenticated USING (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
);

-- RLS: doktorantlar
CREATE POLICY doktorantlar_select ON public.doktorantlar FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
  OR supervisor_id = current_user_supervisor_id()
  OR auth_user_id = auth.uid()
);
CREATE POLICY doktorantlar_insert ON public.doktorantlar FOR INSERT TO authenticated WITH CHECK (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
);
CREATE POLICY doktorantlar_update ON public.doktorantlar FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
  OR supervisor_id = current_user_supervisor_id()
  OR auth_user_id = auth.uid()
);
CREATE POLICY doktorantlar_delete ON public.doktorantlar FOR DELETE TO authenticated USING (
  is_super_admin()
  OR (current_user_role_name() = 'science_department' AND university_id = current_user_university_id())
);

-- RLS: evaluations
CREATE POLICY evaluations_select ON public.evaluations FOR SELECT TO authenticated USING (
  is_super_admin()
  OR supervisor_id = current_user_supervisor_id()
  OR doktorant_id = current_user_doktorant_id()
  OR (current_user_role_name() = 'science_department' AND EXISTS (SELECT 1 FROM public.doktorantlar d WHERE d.id = doktorant_id AND d.university_id = current_user_university_id()))
);
CREATE POLICY evaluations_insert ON public.evaluations FOR INSERT TO authenticated WITH CHECK (
  supervisor_id = current_user_supervisor_id()
);
CREATE POLICY evaluations_update ON public.evaluations FOR UPDATE TO authenticated USING (
  supervisor_id = current_user_supervisor_id()
);
CREATE POLICY evaluations_delete ON public.evaluations FOR DELETE TO authenticated USING (
  supervisor_id = current_user_supervisor_id()
);

-- RLS: progress_reports
CREATE POLICY progress_reports_select ON public.progress_reports FOR SELECT TO authenticated USING (
  is_super_admin()
  OR doktorant_id = current_user_doktorant_id()
  OR EXISTS (SELECT 1 FROM public.doktorantlar d WHERE d.id = doktorant_id AND d.supervisor_id = current_user_supervisor_id())
  OR (current_user_role_name() = 'science_department' AND EXISTS (SELECT 1 FROM public.doktorantlar d WHERE d.id = doktorant_id AND d.university_id = current_user_university_id()))
);
CREATE POLICY progress_reports_insert ON public.progress_reports FOR INSERT TO authenticated WITH CHECK (
  doktorant_id = current_user_doktorant_id()
);
CREATE POLICY progress_reports_update ON public.progress_reports FOR UPDATE TO authenticated USING (
  doktorant_id = current_user_doktorant_id()
  OR EXISTS (SELECT 1 FROM public.doktorantlar d WHERE d.id = doktorant_id AND d.supervisor_id = current_user_supervisor_id())
);
CREATE POLICY progress_reports_delete ON public.progress_reports FOR DELETE TO authenticated USING (
  doktorant_id = current_user_doktorant_id()
);

-- Drop old policies for storage.objects if they exist for progress-reports
DROP POLICY IF EXISTS progress_reports_storage_select ON storage.objects;
DROP POLICY IF EXISTS progress_reports_storage_insert ON storage.objects;

-- RLS for progress-reports bucket
CREATE POLICY progress_reports_storage_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'progress-reports' AND (
    is_super_admin()
    OR (current_user_role_name() = 'science_department')
    OR (storage.foldername(name))[1] = current_user_doktorant_id()::text
    OR EXISTS (SELECT 1 FROM public.doktorantlar d WHERE d.id::text = (storage.foldername(name))[1] AND d.supervisor_id = current_user_supervisor_id())
  )
);

CREATE POLICY progress_reports_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'progress-reports'
  AND (storage.foldername(name))[1] = current_user_doktorant_id()::text
);
