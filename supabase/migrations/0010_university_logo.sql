ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS logo_url text;

DROP POLICY IF EXISTS universities_write ON public.universities;
CREATE POLICY universities_write ON public.universities FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (current_user_role_name() = 'university_admin' AND id = current_user_university_id())
  )
  WITH CHECK (
    is_super_admin()
    OR (current_user_role_name() = 'university_admin' AND id = current_user_university_id())
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('university-logos', 'university-logos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS university_logos_select ON storage.objects;
DROP POLICY IF EXISTS university_logos_insert ON storage.objects;
DROP POLICY IF EXISTS university_logos_update ON storage.objects;
DROP POLICY IF EXISTS university_logos_delete ON storage.objects;

CREATE POLICY university_logos_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'university-logos'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = current_user_university_id()::text
  )
);

CREATE POLICY university_logos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'university-logos'
  AND current_user_role_name() = 'university_admin'
  AND (storage.foldername(name))[1] = current_user_university_id()::text
);

CREATE POLICY university_logos_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'university-logos'
    AND current_user_role_name() = 'university_admin'
    AND (storage.foldername(name))[1] = current_user_university_id()::text
  )
  WITH CHECK (
    bucket_id = 'university-logos'
    AND current_user_role_name() = 'university_admin'
    AND (storage.foldername(name))[1] = current_user_university_id()::text
  );

CREATE POLICY university_logos_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'university-logos'
  AND current_user_role_name() = 'university_admin'
  AND (storage.foldername(name))[1] = current_user_university_id()::text
);
