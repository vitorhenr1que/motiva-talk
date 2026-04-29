import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';
import { handleApiError } from '@/lib/api-errors';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels/[id]';

/**
 * Handle individual channel operations like DELETE
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });
    
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    await ChannelConnectionService.deleteChannel(id, organizationId);
    
    return NextResponse.json({
      success: true,
      message: 'Canal e instância removidos com sucesso'
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

/**
 * Handle channel updates
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const updateData: any = {};
    if (body.allowAgentNameEdit !== undefined) updateData.allowAgentNameEdit = body.allowAgentNameEdit;
    if (body.defaultSectorId !== undefined) updateData.defaultSectorId = body.defaultSectorId;
    if (body.allowAgentFilterAllSectors !== undefined) updateData.allowAgentFilterAllSectors = body.allowAgentFilterAllSectors;
    if (body.whatsappProvider !== undefined) {
      if (!['EVOLUTION', 'META_CLOUD'].includes(body.whatsappProvider)) {
        return NextResponse.json({ success: false, message: 'Provedor WhatsApp inválido' }, { status: 400 });
      }
      updateData.whatsappProvider = body.whatsappProvider;
    }

    if (updateData.defaultSectorId) {
      const { data: sector } = await supabaseAdmin
        .from('Sector')
        .select('id')
        .eq('id', updateData.defaultSectorId)
        .eq('organizationId', organizationId)
        .maybeSingle();

      if (!sector) {
        return NextResponse.json({ success: false, message: 'Setor padrão não encontrado' }, { status: 404 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('Channel')
      .update(updateData)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single();

    if (error) throw error;

    const safeData = { ...data };
    delete safeData.metaAccessToken;

    return NextResponse.json({
      success: true,
      data: safeData
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
