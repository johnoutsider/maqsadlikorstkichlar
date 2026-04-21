INSERT INTO storage.buckets (id, name, public)
VALUES ('doktorant-avatars', 'doktorant-avatars', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS doktorant_avatars_select ON storage.objects;
DROP POLICY IF EXISTS doktorant_avatars_insert ON storage.objects;
DROP POLICY IF EXISTS doktorant_avatars_update ON storage.objects;
DROP POLICY IF EXISTS doktorant_avatars_delete ON storage.objects;

CREATE POLICY doktorant_avatars_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'doktorant-avatars' AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = current_user_doktorant_id()::text
    OR EXISTS (
      SELECT 1
      FROM public.doktorantlar d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.supervisor_id = current_user_supervisor_id()
    )
    OR (
      current_user_role_name() = 'science_department'
      AND EXISTS (
        SELECT 1
        FROM public.doktorantlar d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.university_id = current_user_university_id()
      )
    )
  )
);

CREATE POLICY doktorant_avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'doktorant-avatars'
  AND (storage.foldername(name))[1] = current_user_doktorant_id()::text
);

CREATE POLICY doktorant_avatars_update ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'doktorant-avatars'
  AND (storage.foldername(name))[1] = current_user_doktorant_id()::text
);

CREATE POLICY doktorant_avatars_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'doktorant-avatars'
  AND (storage.foldername(name))[1] = current_user_doktorant_id()::text
);
