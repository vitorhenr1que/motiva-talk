import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { handleApiError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/settings/chat';

export async function GET(req: Request) {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('ChatSetting')
      .select('*')
      .single()

    // Se não existir, retorna default para não quebrar
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({ 
        success: true, 
        data: { 
          autoIdentifyAgent: false, 
          allowAgentNameEdit: false 
        } 
      })
    }

    if (error) throw error
    
    // Mapeamento caso o banco ainda use o nome antigo allowAgentEditName
    return NextResponse.json({ 
      success: true, 
      data: {
        autoIdentifyAgent: settings.autoIdentifyAgent,
        allowAgentNameEdit: settings.allowAgentNameEdit ?? (settings as any).allowAgentEditName ?? false
      }
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function PATCH(req: Request) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new Error('Não autorizado')

    const role = await getUserRole(userSession.email!)
    if (role !== 'ADMIN') throw new Error('Acesso negado')

    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    const { autoIdentifyAgent, allowAgentNameEdit } = body

    // Tenta atualizar ou inserir se não existir
    const { data: existing } = await supabaseAdmin.from('ChatSetting').select('id').single()

    let result;
    const payload = { 
      autoIdentifyAgent, 
      allowAgentNameEdit: allowAgentNameEdit 
    };

    if (existing) {
      result = await supabaseAdmin
        .from('ChatSetting')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabaseAdmin
        .from('ChatSetting')
        .insert([payload])
        .select()
        .single()
    }

    if (result.error) throw result.error
    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
