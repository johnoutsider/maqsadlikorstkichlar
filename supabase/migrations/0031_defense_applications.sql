-- ============================================================================
-- Public defense-application portal (no-login submission) + Telegram linking.
--
-- Flow: applicant (no account) -> science_department -> vice_rector -> routed
-- to the relevant department's staff_manager.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Staff phone numbers (used to map a user to a Telegram chat_id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;

-- ----------------------------------------------------------------------------
-- telegram_contacts: phone -> Telegram chat_id, linked by "Share contact"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_contacts (
  phone           text PRIMARY KEY,
  chat_id         bigint NOT NULL,
  linked_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_contacts_chat ON public.telegram_contacts (chat_id);

-- ----------------------------------------------------------------------------
-- defense_applications: one row per dissertation-defense document package
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.defense_applications (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id            uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  reference_code           text UNIQUE NOT NULL,

  applicant_full_name      text,
  applicant_phone          text,
  phone_verified           boolean NOT NULL DEFAULT false,
  applicant_chat_id        bigint,

  dissertation_info        jsonb NOT NULL DEFAULT '{}'::jsonb,
  avtoreferat_info         jsonb NOT NULL DEFAULT '{}'::jsonb,
  documents                jsonb NOT NULL DEFAULT '{}'::jsonb, -- { [docKey]: string[] }

  department_id            uuid REFERENCES public.departments(id) ON DELETE SET NULL,

  status                   text NOT NULL DEFAULT 'draft' CHECK (status IN (
                             'draft',
                             'pending_science',
                             'pending_vice_rector',
                             'needs_revision',
                             'approved',
                             'rejected'
                           )),

  science_reviewed_by      uuid REFERENCES public.users(id),
  science_reviewed_at      timestamptz,
  science_comment          text,

  vice_rector_reviewed_by  uuid REFERENCES public.users(id),
  vice_rector_reviewed_at  timestamptz,
  vice_rector_comment      text,

  review_history           jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_defense_applications_university
  ON public.defense_applications (university_id, status);
CREATE INDEX IF NOT EXISTS idx_defense_applications_phone
  ON public.defense_applications (applicant_phone);
CREATE INDEX IF NOT EXISTS idx_defense_applications_department
  ON public.defense_applications (department_id);

-- ----------------------------------------------------------------------------
-- Storage bucket: defense-applications
--   Path convention: {application_id}/{docKey}/{filename}
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('defense-applications', 'defense-applications', false)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- RLS
--
-- All writes from the public form go through the service-role client (which
-- bypasses RLS), so there are intentionally no INSERT policies here for the
-- anon/authenticated roles. Staff read/update access is scoped below.
-- ----------------------------------------------------------------------------
ALTER TABLE public.defense_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_contacts    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS defense_applications_select ON public.defense_applications;
CREATE POLICY defense_applications_select ON public.defense_applications FOR SELECT TO authenticated USING (
  is_super_admin()
  OR (
    university_id = current_user_university_id()
    AND current_user_role_name() IN ('university_admin', 'science_department', 'vice_rector')
  )
  OR (
    current_user_role_name() = 'staff_manager'
    AND department_id = current_user_department_id()
  )
);

DROP POLICY IF EXISTS defense_applications_update ON public.defense_applications;
CREATE POLICY defense_applications_update ON public.defense_applications FOR UPDATE TO authenticated USING (
  is_super_admin()
  OR (
    university_id = current_user_university_id()
    AND current_user_role_name() IN ('university_admin', 'science_department', 'vice_rector')
  )
);

DROP POLICY IF EXISTS telegram_contacts_select ON public.telegram_contacts;
CREATE POLICY telegram_contacts_select ON public.telegram_contacts FOR SELECT TO authenticated USING (
  is_super_admin() OR linked_user_id = auth.uid()
);

-- ----------------------------------------------------------------------------
-- Storage RLS: staff can read documents for applications they can see
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS defense_applications_storage_select ON storage.objects;
CREATE POLICY defense_applications_storage_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'defense-applications'
  AND (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.defense_applications da
      WHERE da.id::text = (storage.foldername(name))[1]
        AND (
          (
            da.university_id = current_user_university_id()
            AND current_user_role_name() IN ('university_admin', 'science_department', 'vice_rector')
          )
          OR (
            current_user_role_name() = 'staff_manager'
            AND da.department_id = current_user_department_id()
          )
        )
    )
  )
);
