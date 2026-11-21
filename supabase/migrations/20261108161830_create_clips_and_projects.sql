/*
# Create clips, projects and private clip storage

1. New Tables
- `clips`: one uploaded match clip per row. Stores name, storage path, duration, dimensions, size, and owner.
- `projects`: one analysis per clip. Stores all tracked players, annotations, and markers as JSON, plus owner and last-saved time.

2. New Storage
- Private bucket `clips` for the uploaded video files. Each user can only write and read files inside their own folder (folder name = user id).

3. Security
- Row level security enabled on both tables.
- Each signed-in user can only read, create, change, and delete their own clips and projects.
- Storage objects in `clips` are limited to the owner's folder.

4. Important Notes
- Owner columns default to the signed-in user so inserts do not need to pass it.
- Deleting a clip removes its project through a cascade.
*/

CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  duration_seconds double precision NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clips_user_id_created_at_idx ON clips (user_id, created_at DESC);

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON clips TO authenticated;

DROP POLICY IF EXISTS "select_own_clips" ON clips;
CREATE POLICY "select_own_clips" ON clips FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_clips" ON clips;
CREATE POLICY "insert_own_clips" ON clips FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_clips" ON clips;
CREATE POLICY "update_own_clips" ON clips FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_clips" ON clips;
CREATE POLICY "delete_own_clips" ON clips FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL UNIQUE REFERENCES clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{"players":[],"annotations":[],"markers":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clips', 'clips', false, 157286400, ARRAY['video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 157286400,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm'];

DROP POLICY IF EXISTS "clips_bucket_select_own" ON storage.objects;
CREATE POLICY "clips_bucket_select_own" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "clips_bucket_insert_own" ON storage.objects;
CREATE POLICY "clips_bucket_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "clips_bucket_update_own" ON storage.objects;
CREATE POLICY "clips_bucket_update_own" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "clips_bucket_delete_own" ON storage.objects;
CREATE POLICY "clips_bucket_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);
