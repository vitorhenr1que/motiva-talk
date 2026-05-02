import type { WhatsAppProvider } from "./whatsapp-provider";
import { evolutionProvider } from "./evolution-provider";
import { metaCloudProvider } from "./meta-cloud-provider";
import type { WhatsAppProviderType } from "@/types/chat";

type ProviderLikeChannel = {
  whatsappProvider?: WhatsAppProviderType | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
};

export function resolveWhatsAppProviderType(
  channel?: ProviderLikeChannel | null
): WhatsAppProviderType {
  if (channel?.whatsappProvider) return channel.whatsappProvider;
  if (channel?.metaPhoneNumberId || channel?.metaAccessToken) return 'META_CLOUD';
  return 'EVOLUTION';
}

export function getWhatsAppProvider(type?: WhatsAppProviderType | null): WhatsAppProvider {
  if (type === 'META_CLOUD') {
    return metaCloudProvider;
  }
  // Default to EVOLUTION for backward compatibility
  return evolutionProvider;
}

export type { WhatsAppProvider };
export { evolutionProvider, metaCloudProvider };
