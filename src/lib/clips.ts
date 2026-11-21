import { supabase } from '@/lib/supabase';
import { readVideoMetadata } from '@/lib/video';
import { MAX_CLIP_BYTES, MAX_CLIP_SECONDS } from '@/types';

export type Clip = {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  duration_seconds: number;
  width: number;
  height: number;
  file_size_bytes: number;
  created_at: string;
};

const BUCKET = 'clips';
const LINK_LIFETIME_SECONDS = 3600;
const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export async function listClips(): Promise<Clip[]> {
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Clip[];
}

export async function uploadClip(userId: string, file: File): Promise<Clip> {
  const rawExtension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[rawExtension];
  if (!contentType) throw new Error('Please upload an MP4, MOV, or WebM video.');
  if (file.size > MAX_CLIP_BYTES) {
    throw new Error(`This file is ${Math.round(file.size / 1048576)} MB. Clips must be ${MAX_CLIP_BYTES / 1048576} MB or smaller.`);
  }

  const metadata = await readVideoMetadata(file);
  if (metadata.duration > MAX_CLIP_SECONDS) {
    throw new Error(`Clips must be ${MAX_CLIP_SECONDS} seconds or shorter. This one is ${Math.round(metadata.duration)} seconds.`);
  }

  const path = `${userId}/${crypto.randomUUID()}.${rawExtension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('clips')
    .insert({
      name: file.name.replace(/\.[^.]+$/, ''),
      storage_path: path,
      duration_seconds: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      file_size_bytes: file.size,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as Clip;
}

export async function getClipCopyUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, LINK_LIFETIME_SECONDS);
  if (error) throw error;

  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error('This clip could not be downloaded. Please reopen it.');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function deleteClip(clip: Clip): Promise<void> {
  const { error } = await supabase.from('clips').delete().eq('id', clip.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([clip.storage_path]);
}
