import React from 'react';

/**
 * Utilitário de formatação de texto estilo WhatsApp.
 * Suporta:
 * - *negrito* -> <strong>
 * - _itálico_ -> <em>
 * - ~tachado~ -> <del>
 * - `monoespaçado` -> <code>
 * - Links (http/https/www) -> <a>
 * 
 * Processa de forma recursiva para suportar combinações como *_negrito e itálico_*.
 */
export function formatWhatsappText(text: string, debug = false): React.ReactNode {
  if (!text) return text;
  
  if (debug) {
    console.log(`[WHATSAPP_FORMAT] Analisando: "${text}"`);
  }

  // Padrão que identifica links e marcadores do WhatsApp
  // Capturamos tudo o que pode ser um token de formatação ou um link
  const combinedRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g;

  // Divide o texto, mantendo os delimitadores nos resultados
  const parts = text.split(combinedRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // 1. Links (Prioridade alta)
    if (part.match(/^https?:\/\/[^\s]+$/) || part.match(/^www\.[^\s]+$/)) {
      const href = part.startsWith('www.') ? `http://${part}` : part;
      return (
        <a 
          key={index} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {part}
        </a>
      );
    }

    // 2. Negrito: *texto*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const content = part.slice(1, -1);
      return <strong key={index} className="font-bold">{formatWhatsappText(content, debug)}</strong>;
    }

    // 3. Itálico: _texto_
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      const content = part.slice(1, -1);
      return <em key={index} className="italic">{formatWhatsappText(content, debug)}</em>;
    }

    // 4. Tachado: ~texto~
    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      const content = part.slice(1, -1);
      return <del key={index} className="line-through opacity-80">{formatWhatsappText(content, debug)}</del>;
    }

    // 5. Monoespaçado (Code): `texto`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const content = part.slice(1, -1);
      return (
        <code 
          key={index} 
          className="bg-black/5 px-1.5 py-0.5 rounded font-mono text-[0.85em] border border-black/10 inline-block align-middle leading-none"
        >
          {content}
        </code>
      );
    }

    // 6. Texto normal
    return part;
  });
}
