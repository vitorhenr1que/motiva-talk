import { NextResponse } from 'next/server'
import { TagService } from '@/services/tags'
import { handleApiError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/tags';

export async function GET(req: Request) {
  try {
    const tags = await TagService.getAll()
    return NextResponse.json({ success: true, data: tags })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
