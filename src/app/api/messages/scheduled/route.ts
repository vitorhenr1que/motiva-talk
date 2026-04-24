import { NextRequest, NextResponse } from 'next/server'
import { MessageRepository } from '@/repositories/messageRepository'
import { handleApiError, AppError } from '@/lib/api-errors'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ROUTE = 'GET /api/messages/scheduled'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) throw new AppError('conversationId é obrigatório', 400);

    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('conversationId', conversationId)
      .eq('sendStatus', 'scheduled')
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
