'use client'

import Image from 'next/image'
import { useState } from 'react'

interface ContactAvatarProps {
  name?: string | null
  photoUrl?: string | null
  sizes?: string
  className?: string
}

const COLOR_CLASSES = [
  'from-blue-100 to-indigo-100 text-indigo-700',
  'from-emerald-100 to-teal-100 text-teal-700',
  'from-amber-100 to-orange-100 text-orange-700',
  'from-fuchsia-100 to-violet-100 text-violet-700',
  'from-rose-100 to-pink-100 text-rose-700',
]

export function getContactInitials(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = Array.from(parts[0])[0] || ''
  const last = parts.length > 1 ? Array.from(parts.at(-1) || '')[0] || '' : Array.from(parts[0])[1] || ''
  return `${first}${last}`.toLocaleUpperCase('pt-BR')
}

function avatarColor(name?: string | null) {
  const hash = Array.from(String(name || '?')).reduce((total, character) => total + (character.codePointAt(0) || 0), 0)
  return COLOR_CLASSES[hash % COLOR_CLASSES.length]
}

export function ContactAvatar({ name, photoUrl, sizes = '96px', className = '' }: ContactAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const managedPhoto = photoUrl?.startsWith('/api/contacts/') ? photoUrl : null
  const failed = Boolean(managedPhoto && managedPhoto === failedUrl)

  return (
    <span className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${avatarColor(name)} ${className}`}>
      {managedPhoto && !failed ? (
        <Image
          src={managedPhoto}
          alt={`Foto de ${name || 'contato'}`}
          fill
          sizes={sizes}
          unoptimized
          className="object-cover"
          onError={() => setFailedUrl(managedPhoto)}
        />
      ) : (
        <span aria-hidden="true" className="select-none font-black uppercase tracking-tight">
          {getContactInitials(name)}
        </span>
      )}
    </span>
  )
}
