import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { organizationRepository } from '@/repositories/organizationRepository';
import { LimitsService } from '@/services/limits.service';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/organizations';

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();

    const orgs = await organizationRepository.findAll();

    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const usage = await LimitsService.getOrganizationUsage(org.id);
        return {
          ...org,
          usage: {
            channelCount: usage.channelCount,
            userCount: usage.userCount,
            pendingInvitesCount: usage.pendingInvitesCount,
            monthlyMessageCount: usage.monthlyMessageCount,
            serviceConversationCount: usage.serviceConversationCount,
          },
        };
      })
    );

    console.log(`[PLATFORM] GET ${ROUTE} -> ${enriched.length} orgs`);
    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
