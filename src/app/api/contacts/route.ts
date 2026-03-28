import { NextRequest, NextResponse } from 'next/server'
import { ContactRepository } from '@/repositories/contactRepository'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/contacts';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    
    let query = searchParams.get('query') || '';

    const contacts = await ContactRepository.findMany()
    
    // Filtro simples no backend (poderia ser via query Supabase mas aqui vamos filtrar o resultado)
    let filtered = contacts || [];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((c: any) => 
        c.name.toLowerCase().includes(s) || 
        c.phone.includes(s)
      );
    }

    return NextResponse.json({ success: true, data: filtered })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['name', 'phone'])
    const { name, phone } = body

    // Normaliza telefone
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 8) {
      throw new AppError('Telefone inválido', 400, 'VALIDATION_ERROR')
    }

    // Verifica se já existe
    const existing = await ContactRepository.findByPhone(cleanPhone)
    if (existing) {
      return NextResponse.json({ 
        success: false, 
        message: 'Já existe um contato com este telefone.',
        data: existing 
      }, { status: 409 })
    }

    const contact = await ContactRepository.create({
      name,
      phone: cleanPhone
    })

    return NextResponse.json({ success: true, data: contact }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
