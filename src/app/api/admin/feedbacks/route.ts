import { NextRequest, NextResponse } from 'next/server';
import { FeedbackService } from '@/services/feedback.service';
import { getServerSession, getUserRole } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getServerSession();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getUserRole(user.email!);
    if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : undefined;
    const maxScore = searchParams.get('maxScore') ? parseInt(searchParams.get('maxScore')!) : undefined;
    const agentId = searchParams.get('agentId') || undefined;

    const filters = { startDate, endDate, minScore, maxScore, agentId };
    
    const [list, summary] = await Promise.all([
      FeedbackService.listFeedbacks(filters),
      FeedbackService.getFeedbackSummary(filters)
    ]);

    return NextResponse.json({ 
      success: true, 
      data: {
        list,
        summary
      }
    });
  } catch (error: any) {
    console.error('[ADMIN_FEEDBACK_API_ERROR]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
