import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    const { mode } = await req.json(); // 'me' ou 'everyone'

    console.log(`[API_DELETE] Excluindo mensagem ${id} Modo[${mode}]`);

    if (mode === 'everyone') {
      const updated = await MessageService.deleteForEveryone(id, organizationId);
      return NextResponse.json({ success: true, data: updated });
    } else {
      const updated = await MessageService.deleteForMe(id, organizationId);
      return NextResponse.json({ success: true, data: updated });
    }
  } catch (error) {
    return handleApiError(error, req, { route: '/api/messages/[id]/delete' })
  }
}
