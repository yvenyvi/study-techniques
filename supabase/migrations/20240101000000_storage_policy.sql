-- Enable RLS for storage.objects if not already enabled (skipped because not owner)

-- Allow anon to upload files to the pdfs bucket
CREATE POLICY "Allow anon uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'pdfs');

-- Allow anon to download files from the pdfs bucket
CREATE POLICY "Allow anon downloads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'pdfs');
