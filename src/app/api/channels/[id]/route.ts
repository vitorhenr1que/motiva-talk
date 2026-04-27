import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';
import { handleApiError } from '@/lib/api-errors';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });
    
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    await ChannelConnectionService.deleteChannel(id);
    
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
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const updateData: any = {};
    if (body.allowAgentNameEdit !== undefined) updateData.allowAgentNameEdit = body.allowAgentNameEdit;
    if (body.defaultSectorId !== undefined) updateData.defaultSectorId = body.defaultSectorId;
    if (body.allowAgentFilterAllSectors !== undefined) updateData.allowAgentFilterAllSectors = body.allowAgentFilterAllSectors;

    const { data, error } = await supabaseAdmin
      .from('Channel')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
