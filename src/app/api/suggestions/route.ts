import { NextResponse } from 'next/server'
import { SuggestionService } from '@/services/suggestions'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { content, channelId } = body
    
    if (!content) return NextResponse.json({ error: 'Conteúdo necessário' }, { status: 400 })

    const suggestions = await SuggestionService.findSuggestions(content, channelId)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('API Error (Suggestions POST):', error)
    return NextResponse.json({ error: 'Erro ao buscar sugestões' }, { status: 500 })
  }
}
