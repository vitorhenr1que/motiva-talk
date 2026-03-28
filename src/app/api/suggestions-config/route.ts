import { NextResponse } from 'next/server'
import { SuggestionService } from '@/services/suggestions'

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
    
    return NextResponse.json(suggestions)
  } catch (error: any) {
    console.error('API Error (Suggestions Config GET):', error)
    return NextResponse.json({ 
      error: 'Erro ao buscar configurações de sugestões',
      details: error?.message || 'Erro desconhecido'
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { keyword, triggers, response, category, channelId, isActive } = body

    if (!keyword || !triggers || !response || !category) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const suggestion = await SuggestionService.createSuggestion({
      keyword,
      triggers,
      response,
      category,
      channelId,
      isActive
    })

    return NextResponse.json(suggestion, { status: 201 })
  } catch (error) {
    console.error('API Error (Suggestions Config POST):', error)
    return NextResponse.json({ error: 'Erro ao criar sugestão' }, { status: 500 })
  }
}
