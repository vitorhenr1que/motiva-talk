import { NextResponse } from 'next/server';
import { handleApiError, AppError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import {
  organizationRepository,
  type Organization,
  type OrganizationStatus,
} from '@/repositories/organizationRepository';
import { LimitsService } from '@/services/limits.service';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/organizations/[id]';

const ALLOWED_STATUS: OrganizationStatus[] = ['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELED'];

const EDITABLE_FIELDS: (keyof Organization)[] = [
  'plan',
  'status',
  'maxChannels',
  'maxUsers',
  'maxMsgPerMonth',
  'trialEndsAt',
  'blockedReason',
];

function pickEditableFields(body: Record<string, unknown>): Partial<Organization> {
  const out: Partial<Organization> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) (out as Record<string, unknown>)[key] = body[key];
  }
  return out;
}

function validatePayload(payload: Partial<Organization>) {
  if (payload.status !== undefined && !ALLOWED_STATUS.includes(payload.status as OrganizationStatus)) {
    throw new AppError(`status inválido: ${payload.status}`, 400, 'VALIDATION_ERROR');
  }
  for (const k of ['maxChannels', 'maxUsers', 'maxMsgPerMonth'] as const) {
    const v = payload[k];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw new AppError(`${k} deve ser inteiro >= 0 ou null`, 400, 'VALIDATION_ERROR');
    }
  }
  if (payload.trialEndsAt !== undefined && payload.trialEndsAt !== null) {
    const t = new Date(payload.trialEndsAt);
    if (Number.isNaN(t.getTime())) {
      throw new AppError('trialEndsAt deve ser ISO timestamp válido', 400, 'VALIDATION_ERROR');
    }
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await ctx.params;

    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');

    const usage = await LimitsService.getOrganizationUsage(id);

    return NextResponse.json({
      success: true,
      data: {
        ...org,
        usage: {
          channelCount: usage.channelCount,
          userCount: usage.userCount,
          pendingInvitesCount: usage.pendingInvitesCount,
          monthlyMessageCount: usage.monthlyMessageCount,
        },
      },
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await ctx.params;

    const body = await req.json();
    const payload = pickEditableFields(body);
    validatePayload(payload);

    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');

    const updated = await organizationRepository.update(id, payload);
    console.log(
      `[PLATFORM] PATCH org=${id} by=${admin.email} fields=${Object.keys(payload).join(',')}`
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
