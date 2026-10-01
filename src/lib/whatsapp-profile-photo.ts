// Keep multipart requests below the hosting platform's request size limit.
export const MAX_PROFILE_PHOTO_BYTES = 4 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;

export function validateProfilePhoto(file: { size: number; type: string }): string | null {
  if (!PROFILE_PHOTO_TYPES.some((type) => type === file.type)) {
    return 'Selecione uma imagem JPG ou PNG.';
  }
  if (file.size <= 0) return 'A imagem está vazia.';
  if (file.size > MAX_PROFILE_PHOTO_BYTES) return 'A imagem deve ter no máximo 4 MB.';
  return null;
}

export function hasProfilePhotoSignature(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return type === 'image/png' && png.every((byte, index) => bytes[index] === byte);
}
