import { NextResponse } from 'next/server'
import { TagService } from '@/services/tags'
import { handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/tags/[id]';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const body = await req.json()
    const updated = await TagService.update(id, organizationId, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    await TagService.delete(id, organizationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
