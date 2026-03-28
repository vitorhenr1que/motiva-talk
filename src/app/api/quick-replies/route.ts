import { NextResponse } from 'next/server'
import { QuickReplyService } from '@/services/quick-replies'
import { handleApiError, validateBody } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/quick-replies';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined

    const replies = await QuickReplyService.listAvailable(channelId)
    return NextResponse.json({ success: true, data: replies })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['title', 'content', 'category'])
    const { title, content, category, channelId } = body

    const reply = await QuickReplyService.addReply({ title, content, category, channelId })
    return NextResponse.json({ success: true, data: reply }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
