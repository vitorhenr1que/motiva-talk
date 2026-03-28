import { NextResponse } from 'next/server'
import { SuggestionService } from '@/services/suggestions'
import { handleApiError, validateBody } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/suggestions';

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['content'])
    const { content, channelId } = body

    const suggestions = await SuggestionService.findSuggestions(content, channelId)
    return NextResponse.json({ success: true, data: suggestions })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
