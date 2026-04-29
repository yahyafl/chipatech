-- Create trade-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-documents',
  'trade-documents',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage
CREATE POLICY "Authenticated users can upload trade documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trade-documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can read trade documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trade-documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "SuperAdmin can delete trade documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trade-documents'
  AND EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  )
);
