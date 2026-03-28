import { supabase } from './supabase';

export const uploadFile = async (
  file: File, 
  bucket: string = 'chat-media'
): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrl;
};

export const deleteFile = async (
  urlOrPath: string, 
  bucket: string = 'chat-media'
): Promise<void> => {
  let path = urlOrPath;
  if (urlOrPath.includes(`${bucket}/`)) {
    path = urlOrPath.split(`${bucket}/`).pop() || urlOrPath;
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw error;
  }
};
