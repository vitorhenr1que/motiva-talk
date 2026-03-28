import { NextRequest, NextResponse } from 'next/server'
import { ContactRepository } from '@/repositories/contactRepository'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name } = body

    if (!id) throw new AppError('ID do contato é obrigatório', 400, 'VALIDATION_ERROR');
    if (!name) throw new AppError('Nome é obrigatório', 400, 'VALIDATION_ERROR');

    const updated = await ContactRepository.update(id, { name })
    
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: '/api/contacts/[id]' })
  }
}
