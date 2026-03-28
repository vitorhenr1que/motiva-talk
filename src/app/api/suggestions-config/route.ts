import { NextResponse } from 'next/server'
import { SuggestionService } from '@/services/suggestions'
import { handleApiError, validateBody } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/suggestions-config';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const keyword = searchParams.get('keyword') || undefined
    const category = searchParams.get('category') || undefined
    const channelId = searchParams.get('channelId') || undefined
    const isActiveStr = searchParams.get('isActive')
    const isActive = isActiveStr === 'true' ? true : (isActiveStr === 'false' ? false : undefined)

    const suggestions = await SuggestionService.listAll({
      keyword,
      category,
      channelId,
      isActive
    })
    
    return NextResponse.json({ success: true, data: suggestions })
  } catch (error: any) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['keyword', 'triggers', 'response', 'category'])
    const { keyword, triggers, response, category, channelId, isActive } = body

    const suggestion = await SuggestionService.createSuggestion({
      keyword,
      triggers,
      response,
      category,
      channelId,
      isActive
    })

    return NextResponse.json({ success: true, data: suggestion }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
