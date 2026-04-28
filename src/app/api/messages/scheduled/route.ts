import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, AppError } from '@/lib/api-errors'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

const ROUTE = 'GET /api/messages/scheduled'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) throw new AppError('conversationId é obrigatório', 400);

    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('conversationId', conversationId)
      .eq('organizationId', organizationId)
      .eq('sendStatus', 'scheduled')
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
