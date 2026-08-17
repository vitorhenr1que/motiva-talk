import { NextRequest, NextResponse } from 'next/server'

import { AppError, handleApiError } from '@/lib/api-errors'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireOrganization } from '@/lib/tenant'
import { ContactRepository } from '@/repositories/contactRepository'

const ROUTE = '/api/contacts/[id]/profile-picture'
const BUCKET = 'contact-avatars'
const MAX_FILE_SIZE = 2 * 1024 * 1024

type RouteContext = { params: Promise<{ id: string }> }

function storagePath(organizationId: string, contactId: string) {
  return `${organizationId}/${contactId}/avatar`
}

function detectImageType(bytes: Uint8Array) {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (isJpeg) return 'image/jpeg'

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const isPng = bytes.length >= 8 && pngSignature.every((byte, index) => bytes[index] === byte)
  if (isPng) return 'image/png'

  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (isWebp) return 'image/webp'

  return null
}

async function getContact(contactId: string, organizationId: string) {
  try {
    return await ContactRepository.findById(contactId, organizationId)
  } catch {
    throw new AppError('Contato não encontrado.', 404, 'NOT_FOUND')
  }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const organizationId = await requireOrganization()
    const { id } = await params
    const contact = await getContact(id, organizationId)

    if (!contact.profilePictureUrl) {
      throw new AppError('Este contato não possui foto cadastrada.', 404, 'NOT_FOUND')
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(storagePath(organizationId, id))

    if (error || !data) {
      throw new AppError('A foto deste contato não está disponível.', 404, 'NOT_FOUND')
    }

    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        'Content-Type': data.type || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const organizationId = await requireOrganization()
    const { id } = await params
    await getContact(id, organizationId)

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      throw new AppError('Selecione uma imagem para o contato.', 400, 'VALIDATION_ERROR')
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      throw new AppError('A imagem deve ter no máximo 2 MB.', 400, 'VALIDATION_ERROR')
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const contentType = detectImageType(bytes)
    if (!contentType) {
      throw new AppError('Use uma imagem JPEG, PNG ou WebP válida.', 400, 'VALIDATION_ERROR')
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath(organizationId, id), bytes, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      })
    if (uploadError) throw uploadError

    const updatedAt = new Date().toISOString()
    const profilePictureUrl = `${ROUTE.replace('[id]', id)}?v=${Date.now()}`
    const contact = await ContactRepository.update(id, organizationId, {
      profilePictureUrl,
      lastProfilePictureFetchAt: updatedAt,
    })

    return NextResponse.json({ success: true, data: contact, profilePictureUrl })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const organizationId = await requireOrganization()
    const { id } = await params
    await getContact(id, organizationId)

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([storagePath(organizationId, id)])
    if (storageError) throw storageError

    const contact = await ContactRepository.update(id, organizationId, {
      profilePictureUrl: null,
      lastProfilePictureFetchAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
