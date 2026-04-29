import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrOwner } from '@/lib/tenant';
import { inviteRepository } from '@/repositories/inviteRepository';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminOrOwner();
    const { id } = await params;
    
    await inviteRepository.delete(id, user.organizationId!);

    return NextResponse.json({ success: true, message: 'Convite revogado com sucesso' });
  } catch (error: any) {
    console.error('Revoke invite error:', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao revogar convite' 
    }, { status: error.status || 500 });
  }
}
