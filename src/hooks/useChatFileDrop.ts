'use client';

import { useState, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { getFileTypeInfo } from '@/lib/file-type';
import { PendingFile } from '@/types/chat';

export const useChatFileDrop = (onFileDrop: (pendingFile: PendingFile) => void) => {
  const [isDragging, setIsDragging] = useState(false);
  const { activeConversation } = useChatStore();

  const isClosed = activeConversation?.status === 'CLOSED';

  const processFile = useCallback((file: File) => {
    if (!file || !activeConversation || isClosed) return;

    const info = getFileTypeInfo(file);
    const kind = info.kind;

    if (kind === 'UNKNOWN') {
      const extension = file.name.split('.').pop()?.toUpperCase() || 'DESCONHECIDO';
      alert(`⚠️ Formato de arquivo não suportado (.${extension}).\nPor favor, tente enviar como um documento padrão (PDF, Word, Excel).`);
      return;
    }

    // Mapa de limites recomendados para WhatsApp e Supabase
    const limits: Record<string, number> = {
      IMAGE: 10 * 1024 * 1024,    // 10MB
      VIDEO: 64 * 1024 * 1024,    // 64MB
      AUDIO: 16 * 1024 * 1024,    // 16MB
      PDF: 100 * 1024 * 1024,     // 100MB
      DOCUMENT: 100 * 1024 * 1024 // 100MB
    };

    const currentLimit = limits[kind] || limits.DOCUMENT;

    if (file.size > currentLimit) {
      const sizeInMB = (currentLimit / 1024 / 1024).toFixed(0);
      alert(`⚠️ Arquivo muito grande para enviar como ${kind}.\n\nO limite máximo é de ${sizeInMB}MB para garantir a entrega no WhatsApp.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    
    // Extração de duração para Áudio e Vídeo
    if (kind === 'AUDIO' || kind === 'VIDEO') {
      const media = kind === 'AUDIO' ? new Audio(previewUrl) : document.createElement('video');
      media.src = previewUrl;
      media.onloadedmetadata = () => {
        const roundedDuration = Math.round(media.duration);
        onFileDrop({ 
           file, 
           previewUrl, 
           kind, 
           duration: roundedDuration 
        });
        console.log(`[MEDIA_DROP_DEBUG] Duração extraída: ${roundedDuration}s`);
      };
    } else {
      onFileDrop({ file, previewUrl, kind, duration: 0 });
    }
  }, [activeConversation, isClosed, onFileDrop]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isClosed) return;
    
    const isFile = e.dataTransfer.types.includes('Files');
    if (isFile && !isDragging) {
      setIsDragging(true);
    }
  }, [isClosed, isDragging]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Verificamos se saiu do elemento atual (evitar lag de sub-elementos)
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    
    if (
      clientX <= rect.left ||
      clientX >= rect.right ||
      clientY <= rect.top ||
      clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isClosed) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [isClosed, processFile]);

  return {
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
    processFile
  };
};
