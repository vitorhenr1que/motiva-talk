import { NextResponse } from 'next/server'
import { TagService } from '@/services/tags'
import { handleApiError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/tags/[id]';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await req.json()
    const updated = await TagService.update(id, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    await TagService.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
