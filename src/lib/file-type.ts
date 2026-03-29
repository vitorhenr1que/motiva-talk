/**
 * Centralized file type detection for the chat application.
 * Identifies kinds: ITEM, VIDEO, AUDIO, PDF, DOCUMENT, UNKNOWN.
 */

import { FileKind } from '@/types/chat';

export interface FileTypeInfo {
  kind: FileKind;
  mimeType: string;
  extension: string;
  isPreviewable: boolean;
}

export const getFileTypeInfo = (file: File | { name: string, type: string }): FileTypeInfo => {
  const mimeType = file.type || '';
  const fileName = file.name || '';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. IMAGE
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return {
      kind: 'IMAGE',
      mimeType: mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      extension,
      isPreviewable: true
    };
  }

  // 2. VIDEO
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(extension)) {
    return {
      kind: 'VIDEO',
      mimeType: mimeType || `video/${extension === 'ogg' ? 'ogg' : 'mp4'}`,
      extension,
      isPreviewable: true
    };
  }

  // 3. AUDIO
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'opus', 'aac'].includes(extension)) {
    return {
      kind: 'AUDIO',
      mimeType: mimeType || `audio/${extension}`,
      extension,
      isPreviewable: true
    };
  }

  // 4. PDF (Special case requested by user)
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return {
      kind: 'PDF',
      mimeType: 'application/pdf',
      extension: 'pdf',
      isPreviewable: true // PDF can be previewed in most browsers
    };
  }

  // 5. DOCUMENT (Other files)
  const commonDocs = ['doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip', 'rar', 'pptx', 'ppt'];
  if (
    mimeType.startsWith('application/') || 
    mimeType.startsWith('text/') || 
    commonDocs.includes(extension)
  ) {
    return {
      kind: 'DOCUMENT',
      mimeType: mimeType || 'application/octet-stream',
      extension,
      isPreviewable: false
    };
  }

  return {
    kind: 'UNKNOWN',
    mimeType: mimeType || 'application/octet-stream',
    extension,
    isPreviewable: false
  };
};

/**
 * Maps internal FileKind to WhatsApp Message Type
 */
export const mapKindToMessageType = (kind: FileKind): string => {
  switch (kind) {
    case 'IMAGE': return 'IMAGE';
    case 'VIDEO': return 'VIDEO';
    case 'AUDIO': return 'AUDIO';
    case 'PDF': return 'DOCUMENT'; // WhatsApp treats PDF as document
    case 'DOCUMENT': return 'DOCUMENT';
    default: return 'DOCUMENT';
  }
};
