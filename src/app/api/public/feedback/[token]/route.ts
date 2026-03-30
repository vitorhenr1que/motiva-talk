import { NextRequest, NextResponse } from 'next/server'
import { FeedbackService } from '@/services/feedback.service'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/public/feedback/[token]';

/**
 * public route to get feedback details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) throw new AppError('Token obrigatório', 400, 'VALIDATION_ERROR');

    const feedback = await FeedbackService.getByToken(token);
    if (!feedback) {
      throw new AppError('Link de feedback não encontrado ou já expirado.', 404, 'NOT_FOUND');
    }

    // Don't leak too much info, just what the form needs
    return NextResponse.json({ 
      success: true, 
      data: {
        id: feedback.id,
        contactName: feedback.contact?.name || 'Cliente',
        agentName: feedback.conversation?.agent?.name || 'Atendente',
        status: feedback.status,
        expiresAt: feedback.expiresAt
      }
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

/**
 * Public route to submit feedback
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    
    if (!token) throw new AppError('Token de feedback ausente.', 400, 'VALIDATION_ERROR');
    
    const { score, comment, categoryOptions } = body;
    
    if (score === undefined || score < 0 || score > 10) {
      throw new AppError('A nota deve ser entre 0 e 10.', 400, 'VALIDATION_ERROR');
    }

    const updated = await FeedbackService.submitFeedback(token, {
      score,
      comment,
      categoryOptions
    });

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    if (error.message === 'ALREADY_SUBMITTED') {
      return NextResponse.json({ success: false, error: 'Este feedback já foi enviado.' }, { status: 400 });
    }
    if (error.message === 'FEEDBACK_EXPIRED') {
      return NextResponse.json({ success: false, error: 'O link de avaliação expirou (janela de 24h).' }, { status: 400 });
    }
    if (error.message === 'RECENT_SUBMISSION') {
      return NextResponse.json({ success: false, error: 'Você já enviou uma avaliação nas últimas 24 horas. Agradecemos sua colaboração!' }, { status: 400 });
    }
    return handleApiError(error, req, { route: ROUTE })
  }
}
