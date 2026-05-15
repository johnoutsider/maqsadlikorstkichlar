-- Add login page logo column
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS login_logo_url text;

-- Make the bucket public so getPublicUrl works for <img> tags (logos are public branding)
UPDATE storage.buckets SET public = true WHERE id = 'university-logos';

-- Allow anon to read university logos so the login page can display them
DROP POLICY IF EXISTS university_logos_select ON storage.objects;
CREATE POLICY university_logos_select ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'university-logos'
);

-- Public RPC so login page can fetch university branding without a session
CREATE OR REPLACE FUNCTION public.public_university_branding()
RETURNS TABLE(name text, short_code text, login_logo_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name, short_code, login_logo_url
  FROM public.universities
  WHERE login_logo_url IS NOT NULL AND login_logo_url <> ''
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_university_branding() TO anon, authenticated;
