import { supabaseAdmin } from '@/lib/supabase-admin';

export interface TenantChannel {
  id: string;
  organizationId: string;
  provider: string | null;
  whatsappProvider?: 'EVOLUTION' | 'META_CLOUD' | null;
  providerSessionId: string | null;
  name: string;
  defaultSectorId: string | null;
  isActive?: boolean;
  phoneNumber?: string;
  connectionStatus?: string | null;
  allowAgentNameEdit?: boolean;
  allowAgentFilterAllSectors?: boolean;
  metaPhoneNumberId?: string | null;
  metaWabaId?: string | null;
  metaAccessToken?: string | null;
  metaWebhookVerifyToken?: string | null;
  createdAt?: string;
}

/**
 * Resolve o Channel responsável por um identificador vindo do webhook
 * (instanceName, providerSessionId ou o próprio Channel.id).
 *
 * É a ÚNICA fonte de verdade do tenant para o pipeline de webhooks:
 * todo organizationId/channelId/provider downstream deve vir daqui.
 *
 * Retorna null se o canal não existir (caller decide se vira 404).
 */
export async function resolveTenantChannel(
  instanceIdentifier: string
): Promise<TenantChannel | null> {
  if (!instanceIdentifier) return null;

  const idNoDashes = instanceIdentifier.replace(/-/g, '');

  const { data, error } = await supabaseAdmin
    .from('Channel')
    .select('*')
    .or(
      `id.eq.${instanceIdentifier},id.eq.${idNoDashes},providerSessionId.eq.${instanceIdentifier}`
    )
    .limit(1);

  if (error) {
    console.error(
      `[TENANT_RESOLVER] Erro ao buscar canal para instance="${instanceIdentifier}":`,
      error.message
    );
    return null;
  }

  const channel = data?.[0];
  if (!channel) return null;

  if (!channel.organizationId) {
    console.error(
      `[TENANT_RESOLVER] Canal ${channel.id} sem organizationId. Tenant não pode ser determinado.`
    );
    return null;
  }

  return channel as TenantChannel;
}
