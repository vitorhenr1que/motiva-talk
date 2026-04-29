import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { BillingRepository, type PlanCode } from '@/repositories/billingRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/billing/plans/[code]/limits';
const EDITABLE_PLAN_CODES: PlanCode[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    await requirePlatformAdmin();
    const { code: rawCode } = await ctx.params;
    const code = rawCode.toUpperCase() as PlanCode;

    if (!EDITABLE_PLAN_CODES.includes(code)) {
      throw new AppError('Plano inválido', 400, 'VALIDATION_ERROR');
    }

    const body = await req.json();
    const { 
      maxChannels, 
      maxUsers, 
      maxMessagesPerMonth,
      maxServiceConversationsPerCycle,
      serviceConversationWindowHours,
      serviceConversationQuotaScope
    } = body;

    const updated = await BillingRepository.updatePlanLimits(code, {
      maxChannels: maxChannels === undefined ? undefined : (maxChannels === '' ? null : Number(maxChannels)),
      maxUsers: maxUsers === undefined ? undefined : (maxUsers === '' ? null : Number(maxUsers)),
      maxMessagesPerMonth: maxMessagesPerMonth === undefined ? undefined : (maxMessagesPerMonth === '' ? null : Number(maxMessagesPerMonth)),
      maxServiceConversationsPerCycle: maxServiceConversationsPerCycle === undefined ? undefined : (maxServiceConversationsPerCycle === '' ? null : Number(maxServiceConversationsPerCycle)),
      serviceConversationWindowHours: serviceConversationWindowHours === undefined ? undefined : (serviceConversationWindowHours === '' ? null : Number(serviceConversationWindowHours)),
      serviceConversationQuotaScope: serviceConversationQuotaScope === undefined ? undefined : (serviceConversationQuotaScope === '' ? null : serviceConversationQuotaScope),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
