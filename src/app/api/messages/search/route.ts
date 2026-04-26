import { NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, AppError } from '@/lib/api-errors'

const ROUTE = '/api/messages/search'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const query = searchParams.get('query')
    const sectorId = searchParams.get('sectorId') || undefined

    // Logs temporários solicitados
    console.log(`[SEARCH_DEBUG] conversationId: ${conversationId} | query: ${query} | sectorId: ${sectorId}`)

    if (!conversationId) {
      throw new AppError('conversationId é obrigatório para busca', 400, 'VALIDATION_ERROR')
    }

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const results = await MessageService.searchMessages(conversationId, query.trim(), sectorId)
    
    console.log(`[SEARCH_DEBUG] Resultados encontrados: ${results.length}`)

    return NextResponse.json({ 
      success: true, 
      data: results 
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
