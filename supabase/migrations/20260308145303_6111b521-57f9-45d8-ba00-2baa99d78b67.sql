-- Create storage bucket for obra photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('obra-fotos', 'obra-fotos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'obra-fotos');

-- RLS: anyone can view (public bucket)
CREATE POLICY "Anyone can view obra photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'obra-fotos');

-- RLS: users can delete own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'obra-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add foto_url column to acoes_corretivas
ALTER TABLE public.acoes_corretivas ADD COLUMN IF NOT EXISTS foto_url text;