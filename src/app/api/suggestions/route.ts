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
    console.log(`[AI_SUGGESTIONS] Content: "${content}", Channel: ${channelId}`);

    const suggestions = await SuggestionService.findSuggestions(content, channelId)
    console.log(`[AI_SUGGESTIONS] Found: ${suggestions.length} matches`);
    
    return NextResponse.json({ success: true, data: suggestions })
  } catch (error) {
    console.error(`[AI_SUGGESTIONS] API Error:`, error);
    return handleApiError(error, req, { route: ROUTE })
  }
}
