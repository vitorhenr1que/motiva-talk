import { NextResponse } from 'next/server'
import { TagService } from '@/services/tags'
import { handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/tags';

export async function GET(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const tags = await TagService.getAll(organizationId)
    return NextResponse.json({ success: true, data: tags })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
